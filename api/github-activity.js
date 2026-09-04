const GRAPHQL_ENDPOINT = "https://api.github.com/graphql";
const LEVEL_MAP = {
  NONE: 0,
  FIRST_QUARTILE: 1,
  SECOND_QUARTILE: 2,
  THIRD_QUARTILE: 3,
  FOURTH_QUARTILE: 4,
};

const GRAPHQL_QUERY = `
  query($from: DateTime!, $to: DateTime!) {
    viewer {
      login
      contributionsCollection(from: $from, to: $to) {
        contributionCalendar {
          totalContributions
          weeks {
            contributionDays {
              contributionCount
              contributionLevel
              date
              weekday
            }
          }
        }
      }
    }
  }
`;

function isoDate(date) {
  return date.toISOString().slice(0, 10);
}

function parseGraphQlCalendar(payload) {
  const viewer = payload?.data?.viewer;
  const calendar = viewer?.contributionsCollection?.contributionCalendar;
  if (!calendar?.weeks?.length) {
    throw new Error("GitHub GraphQL did not return a contribution calendar");
  }

  const cells = [];
  calendar.weeks.forEach((week, weekIndex) => {
    week.contributionDays.forEach((day) => {
      cells.push({
        date: day.date,
        count: Number(day.contributionCount) || 0,
        level: LEVEL_MAP[day.contributionLevel] ?? 0,
        x: weekIndex,
        y: Number(day.weekday) || 0,
      });
    });
  });

  return {
    username: viewer?.login || "mindadeepam",
    total: Number(calendar.totalContributions) || 0,
    cells,
  };
}

async function fetchAuthenticatedCalendar(from, to) {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    throw new Error("Missing GITHUB_TOKEN");
  }

  const response = await fetch(GRAPHQL_ENDPOINT, {
    method: "POST",
    headers: {
      authorization: `Bearer ${token}`,
      "content-type": "application/json",
      "user-agent": "deepamminda.vercel.app",
    },
    body: JSON.stringify({
      query: GRAPHQL_QUERY,
      variables: {
        from: `${from}T00:00:00Z`,
        to: `${to}T23:59:59Z`,
      },
    }),
  });

  if (!response.ok) {
    throw new Error(`GitHub GraphQL returned ${response.status}`);
  }

  const payload = await response.json();
  if (payload.errors?.length) {
    throw new Error(payload.errors.map((error) => error.message).join("; "));
  }

  return parseGraphQlCalendar(payload);
}

module.exports = async (request, response) => {
  const to = isoDate(new Date());
  const from = isoDate(new Date(Date.now() - 365 * 24 * 60 * 60 * 1000));

  try {
    const authenticatedCalendar = await fetchAuthenticatedCalendar(from, to);
    response.setHeader("Cache-Control", "s-maxage=3600, stale-while-revalidate=86400");
    response.status(200).json({
      username: authenticatedCalendar.username,
      from,
      to,
      total: authenticatedCalendar.total,
      cells: authenticatedCalendar.cells,
      source: "authenticated",
      title: "contributions in the last year",
      note: "GitHub contribution calendar over the last 12 months.",
    });
  } catch (error) {
    response.setHeader("Cache-Control", "s-maxage=300, stale-while-revalidate=3600");
    response.status(200).json({
      username: "mindadeepam",
      from,
      to,
      total: 0,
      cells: [],
      source: "error",
      title: "GitHub activity unavailable",
      note: "Couldn't load the contribution graph right now.",
      detail: error instanceof Error ? error.message : String(error),
    });
  }
};
