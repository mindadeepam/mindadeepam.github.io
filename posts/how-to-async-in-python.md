---
title: How to async in python?
date: 2025-06-16
description: Notes on Python async, FastAPI, event loops, tasks, and migrating blocking code.
tags: async, python
source: https://mindadeepam.bearblog.dev/how-to-async-in-python/
---

# How to async in python?

_Originally published on [Bear](https://mindadeepam.bearblog.dev/how-to-async-in-python/)._

Let's say you want to deploy a backend service in Python. You are likely considering between 2 popular options:

- **Flask** - A mature, widely-used framework that's great for synchronous applications. It has a large ecosystem but limited native support for asynchronous programming.
- **FastAPI** - A modern, high-performance framework designed for async programming. It's built on ASGI and integrates well with Python type hints, making it ideal for building scalable, concurrent services.

We'll shortly understand what some of these terms mean, but first, let us deploy a very simple backend service.

A backend server is basically a bunch of endpoints mapped to a bunch of functions. When you deploy your service, others can communicate with your application by sending requests to these endpoints. Let's imagine a backend ai chatbot application that serves 100s of clients.

Above your application layer (app.py) is a gateway layer that takes in requests and processes them. Let's set up a basic Flask application:

app.py

```
from flask import Flask
import time

app = Flask(__name__)

@app.route('/chat')
def get_response_from_llm():
    time.sleep(3)  # Simulate a long-running task (eg, an llm call)
    return 'Hello, World!'

if __name__ == '__main__':
    app.run(debug=True)

```

In the terminal, run this script.

```
python app.py

```

You will see->

```
* Serving Flask app 'app'
 * Debug mode: on
WARNING: This is a development server. Do not use it in a production deployment. Use a production WSGI server instead.
 * Running on http://127.0.0.1:5000
Press CTRL+C to quit
 * Restarting with stat
 * Debugger is active!
 * Debugger PIN: 359-947-748

```

**You might ask, what is a WSGI server?**

A WSGI (Web Server Gateway Interface) server acts as a bridge between your Python web application and the outside world, typically sitting behind a web server like Nginx or running standalone to handle HTTP requests directly. Suppose 3 requests come in at the same time, it is the WSGI server that makes sure they are each handled separately. By default, Flask uses the Werkzeug dev server. It's single-threaded by default. That means only one request is handled at a time, and others may have to wait their turn if the previous request has not finished processing.

If you hit this endpoint with 3 requests at the same time, it'll take 9 seconds!

If you deploy it with a production-grade server like gunicorn instead, you can have it handle each request in a separate thread or process. That instantly makes your service capable of serving more clients simultaneously. (Of course, Werkzeug can also do that, but it's just for prototyping.)

**Concurrent requests and how they are handled**

Before we dive deeper, it's worth understanding two related concepts: **concurrency** and **parallelism**.

- **Concurrency** is when multiple tasks make progress independently, but not necessarily at the same time. Think of it as multitasking - switching between tasks quickly.
- **Parallelism** is when tasks actually run **at the same time**, on separate CPU cores. In Python, we achieve concurrency via threads or asynchronous programming and parallelism via separate cores. These ideas are crucial in backend services, especially when you want to serve 100s of clients at the same time.

**Deploying with gunicorn:** Let’s say we have a 4-core 8 GB RAM machine. It's generally advised to have at most 2-4 threads per core. So if we max out, we can push the concurrency to 4 * 4 -> 16

```
gunicorn app:app --workers 4 --threads 4 --bind 0.0.0.0:8000

```

Compared to the earlier version, 3 concurrent api requests will now take just 3 seconds! And we can serve almost 20 users at the same time.

> It is generally advised to use more processes for CPU-intensive workloads and more threads for I/O intensive workloads. Monitor your machine's memory load and CPU utilization to figure out the optimum configurations.

If you don't already know, it is also worthwhile to note that Python actually only runs one thread per core at a time due to something called the Global Interpreter Lock, aka the GIL. (This has now changed, although only experimentally in Python 3.13) But there's a caveat there, too; the threads still release the GIL on I/O tasks, so if your application is I/O bound, you can push your limit a bit more. Read more about the GIL [here](https://realpython.com/python-gil/)and [here](https://www.dabeaz.com/python/GIL.pdf).

Normal functions defined with `def` are called synchronous functions or blocking code because they stop the interpreter from doing other things when they are running. The only way to serve multiple clients together using synchronous functions is to use multithreading or multiprocessing. This is especially inefficient for tasks like I/O, where the system is just sitting idle. To scale even further, we need to introduce ourselves to _asynchronous processing_.

## Async Programming

Multithreading gives you concurrency, but it has some limitations.


**Context switching between threads involves kernel overhead.**

- Each thread has its own stack and registers, so switching between them requires saving/restoring that state.
- This often triggers a **kernel-mode switch** (especially with preemptive multitasking), which adds latency.
- As the number of threads increases, so does the **context switch frequency**, increasing overhead.


**Each thread consumes memory, typically ~1 MB for the stack.**

- This is the **default thread stack size** on many systems (can be reduced manually).
- With 1000 threads, that's already ~1 GB of memory just for stacks -- even if they're mostly idle.
- This limits scalability in memory-constrained environments.

Async programming offers a way around these limitations by enabling **cooperative multitasking**.

### Cooperative vs Preemptive Multitasking


**Threads** use **preemptive multitasking**: the OS scheduler decides when to pause/resume threads. This allows uncooperative code to hog the CPU but introduces significant overhead.


**Coroutines** use **cooperative multitasking**: they explicitly yield control using `await`, allowing other tasks to run. There's no kernel involvement or state saving, making it fast and lightweight.

### Blocking vs Async Example

Let's demonstrate this with a simple blocking function:

```
# Version 1: Blocking
import time

def sleep(t):
    print(f"Sleeping for {t} seconds")
    time.sleep(t)
    print(f"Done sleeping for {t} seconds")

def main():
    start = time.time()
    sleep(2)
    sleep(1)
    print(f"time taken: {time.time() - start}")

main()

```

**Output:**

```
Sleeping for 2 seconds
Done sleeping for 2 seconds
Sleeping for 1 seconds
Done sleeping for 1 seconds
time taken: ~3.0s

```

Now, let's use **multithreading** to run both concurrently:

```
# Version 2: Multithreading
import threading

def main():
    start = time.time()
    t1 = threading.Thread(target=sleep, args=(2,))
    t2 = threading.Thread(target=sleep, args=(1,))
    t1.start(); t2.start()
    t1.join(); t2.join()
    print(f"time taken: {time.time() - start}")

```

**Output:** `time taken: ~2.0s`

So far, so good. Now let's try **async/await**:

```
# Version 3: Async
import asyncio

async def sleep(t):
    print(f"Sleeping for {t} seconds")
    await asyncio.sleep(t)
    print(f"Done sleeping for {t} seconds")

async def main():
    start = time.time()
    await sleep(2)
    await sleep(1)
    print(f"time taken: {time.time() - start}")

asyncio.run(main())

```

**Output:**

```
Sleeping for 2 seconds
Done sleeping for 2 seconds
Sleeping for 1 seconds
Done sleeping for 1 seconds
time taken: ~3.0s

```

Wait -- wasn't async supposed to help with concurrency? Yes, but the above runs **sequentially**, because we're awaiting each task **one after the other**.

To make them run concurrently, use `asyncio.gather`:

```
# Concurrent version using asyncio.gather
async def main():
    start = time.time()
    await asyncio.gather(sleep(2), sleep(1))
    print(f"time taken: {time.time() - start}")

```

**Output:** `time taken: ~2.0s`

---

## Internals: Coroutines, Tasks, and the Event Loop

Let's understand why this happens by breaking down three key components of async in Python:

### Event Loop

A single-threaded scheduler that runs asynchronous tasks. It maintains:

- A **ready queue**: tasks ready to run
- A **selector/epoll**: watches for I/O readiness (e.g., socket, file, HTTP)

Only one coroutine runs at a time, but it **yields control using `await`**, allowing the event loop to run something else.

```
asyncio.run(main())  # bootstraps the event loop and runs main() coroutine

```

### Coroutines ( `async def`)

A coroutine is a function that can **pause itself** ( `await`) and yield control to the event loop, which can then resume it later. It's like a lightweight thread, but cooperatively scheduled and far more memory-efficient.

```
async def sleep(t):
    await asyncio.sleep(t)

```

### Tasks

When you `await` a coroutine, it runs to completion (or to the next `await`) **within the current coroutine**. It's like calling a function and blocking until it returns.

```
await sleep(2)  # sequential, blocks current coroutine until done

```

If instead you want it to run **independently**, use `asyncio.create_task()`:

```
task = asyncio.create_task(sleep(2))  # schedules it immediately
# ... do other stuff ...
await task  # wait later if needed

```

When you create a task:

- The coroutine is **wrapped in a `Task` object**
- It is added to the **event loop's ready queue**
- It can start executing _immediately_, even if you don't await it right away

This allows true concurrency (within a single thread) -- multiple tasks can yield, pause, and resume independently.

---

Note that a coroutine can have blocking functions inside it, but you can't put coroutines inside blocking functions.

```
# this is wrong
def main():
    await some_coroutine()
    return

## error: SyntaxError: 'await' outside async function

```

FastAPI is the most popular framework that supports asynchronous processing.

Here is a basic FastAPI server deployed using an asynchronous server gateway interface, uvicorn.

```
import uvicorn
from fastapi import FastAPI
import time
import asyncio
app = FastAPI()

@app.get("/")
async def read_root():
    print("Root endpoint accessed")
    return {"message": "Hello World"}

@app.get("/hello/")
async def hello():
    print(f"hi there")
    return

@app.get("/sleep/{t}")
async def sleep(t):
    print(f"stsrting sleeping for {t} seconds")
    start_time = time.time()
    await asyncio.sleep(t)
    print(f"time taken {time.time()-start_time} seconds")
    return

if __name__ == "__main__":
    print("Starting FastAPI application with Uvicorn")
    uvicorn.run(app, host="0.0.0.0", port=8000)

```

Now, if you hit the `/sleep`endpoint with 10-20 concurrent requests, the total time would still be around the maximum value of time passed.

This was all about synchronous programming, especially in FastAPI. Now let's get to some practical nuances and tips when working with async in Python.

## Context Variables

Let's assume we have a request-specific variable, say `request_id`, that we assign to each request. How do you pass this request_id to different functions/coroutines, when the value of a global variable may be changing based on which request is running at that instant?

Context variables are a way to manage and access data that is local to a specific context, such as a coroutine or a task. They are particularly useful in asynchronous programming, where multiple tasks may be running concurrently and need to access shared data without interfering with each other.

Here's a breakdown of how context variables work and why they are useful:

**What are Context Variables?**

- Context variables are similar to thread-local storage but are designed for asynchronous tasks.
- Each task or coroutine gets its own copy of the context variable, so modifications made by one task do not affect others. When a task is created, it copies its context vars with it, and when it resumes, it uses this copied context.
- They are useful for storing request-specific information, like user authentication details, or any other data that should be isolated between different tasks.

**How to Use Context Variables**

Create a Context Variable: Use `contextvars.ContextVar` to create a new context variable.

Set a Value: Use the `set()`method to assign a value to the context variable within a specific context.

Get a Value: Use the `get()`method to retrieve the value of the context variable. If the variable has not been set in the current context, you can provide a default value.

Reset a Value: The `set()`method returns a token that can be used to reset the variable to its previous value using the `reset()`method. This is useful for cleaning up when a context is exited.

**Example**

```
import asyncio
import contextvars

# Create a context variable
request_id = contextvars.ContextVar('request_id')

async def process_request(req_id):
    # Set the request ID for this task
    token = request_id.set(req_id)
    print(f"Processing request {request_id.get()}...")
    await asyncio.sleep(1)  # Simulate some work
    print(f"Request {request_id.get()} processed.")
    request_id.reset(token) # very important to reset the token

async def main():
    # Create multiple tasks, each with a different request ID
    task1 = asyncio.create_task(process_request("req_123"))
    task2 = asyncio.create_task(process_request("req_456"))
    await asyncio.gather(task1, task2)

if __name__ == "__main__":
    asyncio.run(main())

```

In this example:

- `request_id` is a context variable that stores the ID of the current request.
- `process_request` sets the `request_id` for the current task, simulates some work, and then resets the `request_id` to its previous value.
- Each task gets its own copy of the `request_id`, so the tasks do not interfere with each other.

**Use Cases**

- **Request Context:** Storing information about the current HTTP request, such as headers, user authentication details, or request IDs.
- **Tracing and Logging:** Propagating tracing IDs or logging contexts across asynchronous tasks.
- **Configuration:** Providing task-specific configuration values.

**Benefits**

- **Isolation:** Ensures that data is isolated between different tasks, preventing race conditions and other concurrency issues.
- **Clarity:** Makes it clear which data is local to a specific context, improving code readability and maintainability.
- **Asynchronous Compatibility:** Designed to work seamlessly with asynchronous programming models.

Context variables are a powerful tool for managing state in asynchronous applications, providing a way to keep data isolated and organized in concurrent environments.

## How to migrate your codebase:

Below are the changes you need to make while migrating from a blocking codebase to a non-blocking one.

### 1. Change requests to httpx:

All api calls must be asynchronous. Httpx is a modern asynchronous alternative for requests.

```
import httpx
import asyncio

async def get_url(url):
    async with httpx.AsyncClient() as client:
        response = await client.get(url)
        return response.status_code

async def main():
    status_code = await get_url("https://www.example.com")
    print(f"Status code: {status_code}")

if __name__ == "__main__":
    asyncio.run(main())

```

This example demonstrates a simple GET request using `httpx` in an asynchronous manner.

### 2. For SQL database calls, use aiomysql, asyncpg:

SQL libraries also have their async versions, which are mostly a drop-in replacement.

Here's an example using `aiomysql`:

```
import aiomysql
import asyncio

async def fetch_data(query):
    conn = await aiomysql.connect(host='your_host', port=3306,
        user='your_user', password='your_password',
        db='your_db')
    cur = await conn.cursor()
    await cur.execute(query)
    result = await cur.fetchall()
    await cur.close()
    conn.close()
    return result

async def main():
    data = await fetch_data("SELECT * FROM your_table")
    print(data)

if __name__ == "__main__":
    asyncio.run(main())

```

### 3. For MongoDB calls, use motor:

```
from motor.motor_asyncio import AsyncIOMotorClient
import asyncio

async def fetch_data():
    client = AsyncIOMotorClient('mongodb://localhost:27017')
    db = client.your_database_name
    collection = db.your_collection_name
    document = await collection.find_one({'name': 'example'})
    return document

async def main():
    data = await fetch_data()
    print(data)

if __name__ == "__main__":
    asyncio.run(main())

```

### 4. Offloading CPU-intensive tasks

For blocking code that is CPU-intensive, you can offload the task to a separate thread using `asyncio.to_thread`. This allows you to perform CPU-bound operations without blocking the main event loop.

```
import asyncio
import time

def cpu_bound_operation(n, factor):
    # Simulate a CPU-intensive task
    count = 0
    for i in range(n):
        count += i * factor
    return count

async def main():
    print("Starting CPU-bound operation...")
    start_time = time.time()
    # Run the CPU-bound operation in a separate thread
    result = await asyncio.to_thread(cpu_bound_operation, 100_000_000, 2)
    end_time = time.time()
    print(f"CPU-bound operation completed with result: {result}")
    print(f"Time taken: {end_time - start_time:.2f} seconds")

if __name__ == "__main__":
    asyncio.run(main())

```

In this example, `asyncio.to_thread` is used to run the `cpu_bound_operation` function in a separate thread. We pass two arguments to the function. The `await` keyword ensures that the main event loop waits for the thread to complete before continuing. This prevents the CPU-intensive task from blocking the event loop and allows other asynchronous tasks to run concurrently.

### 5. For things that can be parallelized, use tasks

```
import asyncio
import time
import random

async def perform_task(task_id, delay):
    print(f"Task {task_id}: Starting, will sleep for {delay} seconds")
    await asyncio.sleep(delay)
    result = random.randint(1, 100)  # Simulate some work
    print(f"Task {task_id}: Completed, result is {result}")
    return result

async def main():
    start_time = time.time()
    # Create multiple tasks
    task1 = asyncio.create_task(perform_task(1, 2))
    task2 = asyncio.create_task(perform_task(2, 1))
    task3 = asyncio.create_task(perform_task(3, 3))
    # Gather the results (optional, if you need the return values)
    results = await asyncio.gather(task1, task2, task3)
    end_time = time.time()
    print(f"All tasks completed in {end_time - start_time:.2f} seconds")
    print(f"Results: {results}")
if __name__ == "__main__":
    asyncio.run(main())

```

In this example, `asyncio.create_task` is used to create three tasks that run concurrently. `asyncio.gather` is used to wait for all tasks to complete and collect their results. The tasks are executed in parallel, and the total time taken is approximately the time of the longest-running task.

---

By moving from a traditional synchronous framework to an asynchronous one like FastAPI, you can leverage the power of asyncio to build highly concurrent, I/O-bound applications. Each request is handled as a different coroutine, which scales much more efficiently than threads. As we've seen, the key is to understand the event loop, use await for non-blocking calls, and create tasks for parallel execution. With these tools, you're ready to build services that can handle hundreds or even thousands of simultaneous clients with remarkable efficiency.
