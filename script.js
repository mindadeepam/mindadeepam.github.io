const reveals = document.querySelectorAll(".reveal");

const observer = new IntersectionObserver(
  (entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        entry.target.classList.add("is-visible");
        observer.unobserve(entry.target);
      }
    });
  },
  { threshold: 0.16 }
);

reveals.forEach((element, index) => {
  element.style.transitionDelay = `${Math.min(index * 45, 220)}ms`;
  observer.observe(element);
});

const ticker = document.querySelector(".ticker-track");
if (ticker) {
  ticker.innerHTML += ticker.innerHTML;
}
