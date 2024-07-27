---
title: 'Node vs Bun: One Billion Row Challenge'
description: 'An exploration of differences in performance between Node and Bun, using the "1 Billion Row Challenge" as a benchmark. I optimized JavaScript code from an 8-minute runtime to just 15 seconds, employing techniques like custom file reading, typed arrays, and parallelization.'
pubDate: 'Jul 28 2024 15:03'
updatedDate: 'Jul 28 2024 15:03'
heroImage: '../images/1brc/hero.png'
socialImage: '../images/1brc/social.png'
imageAlt: 'Two buff meme doges with their heads replaced by Node.js logo and Bun logo. Versus sign is between them.'
tags: ['javascript', 'node', 'bun']
---

I stumbled upon the challenge not that long ago, and even though it was completed in January of 2024, I still thought it would be fun to try it out for myself and at the same time compare the performance of Node and Bun in this scenario. You can read more about the challenge on [1brc.dev](https://1brc.dev/).

- Tested on a MacBook with M1 Pro CPU (8 P-cores, 2 E-cores) and 32GB of RAM
- Node version 22.0.0
- Bun version 1.1.4

## TLDR

- __Initial naive solution took 7m46s to run. Final solution took 15 seconds.__
- Profiling JavaScript is kind of a pain (Please link me some good guides 🙃).
- Overall, during testing, I didn’t notice that Bun was reliably faster than Node.
- Buffers / TypedArrays are your friends when processing a lot of data.
- Bun is quite great for any daily JS scripting needs: it runs TS without any setup and has some neat utilities.
- It's kind of obvious, but avoid using JavaScript in cases where you need the best possible performance. It's just too much hassle. Debugging and profiling become annoying quite quickly.
- The challenge is quite fun, try it out!

[Single thread version gist](https://gist.github.com/DNFcode/d3c6c17e92b2e55e39f72ba78c9da1eb), [Workers version gist](https://gist.github.com/DNFcode/7e713a5c4561e0f2c6f38237b73ecfa1)

## What is this challenge about?

1. We have a long file with 1 billion rows of data.
2. Each row looks like this: `{station_name};{temperature}`
3. City name is a UTF-8 string of min length 1 character and max length 100 bytes.
4. There is a maximum of 10 000 unique station names.
5. Temperature is a non-null double between -99.9 (inclusive) and 99.9 (inclusive), always with one fractional digit.
6. __We need to calculate min, max and average temperature per station.__
   
```
// The file looks something like this
Bulawayo;8.9
Palembang;38.8
St. John's;15.2
```

You can generate the file using a python script from [here](https://github.com/gunnarmorling/1brc/blob/main/src/main/python/create_measurements.py).

## Approach to the challenge

It’s quite obvious that the most efficient way to speed our code is to parallelize it, but that might not be the wisest way to start the challenge. So I’ve come up with a small plan for myself:

1. Keep on improving a single-thread version as much as possible.
2. Measure time only for parts that process the file, as printing the final outputs or initial setup is going to be a small percentage of the total run time. And I'm not interested about that part much anyway.
3. Try to use profiling to find out what to improve.
4. Parallelize as the last step.

To simplify my life a little bit I made a few adjustments as well:

1. Most tests are run on a smaller file with 100 million rows to speed up testing process.
2. The original testing package expects you to output the results to STDOUT in a specific format. However, I created a simple utility function that takes an object of type `Record<string, {min: number, max: number, totalSum: number, count: number}>` and compares it to the results produced by the initial naive solution, which are stored in a file.

## Table of versions

Here is the table of different improvements and findings.

- [Initial solution](#initial-solution)
- [Dropping readline package](#dropping-readline-package)
- [No nullish coalescing (??) and optional chaining (.?)](#no-nullish-coalescing--and-optional-chaining-)
- [No Math.max / Math.min functions](#no-mathmax--mathmin-functions)
- [Using typed array for storing results](#using-typed-array-for-storing-results)
- [Custom line splitting (Definitely a bad version)](#custom-line-splitting-definitely-a-bad-version)
- [Custom line splitting but better](#custom-line-splitting-but-better)
- [Going insane. Making a custom hash map and skipping conversion to utf-8](#going-insane-making-a-custom-hash-map-and-skipping-conversion-to-utf-8)
- [Parallelization](#parallelization)

### Initial solution

__Node:__ 45,5s\
__Bun:__ 52,5s 🤨

It was meant to be naive and simple just to have a starting point, using built-in `readline` and `fs` Node packages. We're not doing anything fancy here, just reading lines and aggregating the data. As expected it's quite slow.

```js
import * as fs from "fs";
import * as readline from "readline";

const FILE_PATH = "./data/measurements.txt";

async function processFileLineByLine() {
  const fileStream = fs.createReadStream(FILE_PATH, {
    encoding: "utf-8",
  });

  const rl = readline.createInterface({
    input: fileStream,
    crlfDelay: Infinity,
  });

  const results = {};

  for await (const line of rl) {
    const [city, value] = line.split(";");
    const temperature = parseFloat(value);
    results[city] = {
      max: Math.max(results[city]?.max ?? -Infinity, temperature),
      min: Math.min(results[city]?.min ?? Infinity, temperature),
      totalSum: (results[city]?.totalSum ?? 0) + temperature,
      count: (results[city]?.count ?? 0) + 1,
    };
  }
}

processFileLineByLine();
```

### Dropping readline package

__Node:__ 33,3s (-27%)\
__Bun:__ 26,5s (-50%)

Let's try to simply split the lines manually and read chunks from fs stream. That turned out to be quite a significant improvement, don’t really know what could be going on in the readline package.

```js
function readFileLines(onLine, onEnd) {
  const fileStream = fs.createReadStream(FILE_PATH, {
    encoding: "utf-8",
  });
  let remainder = "";

  fileStream.on("data", (chunk) => {
    const lines = (remainder + chunk).split("\n");
    remainder = lines.pop() ?? "";
    for (const line of lines) {
      readLine(line);
    }
  });

  fileStream.on("end", () => {
    onEnd();
  });
}
```

### No nullish coalescing (??) and optional chaining (.?)

__Node:__ 28,0s (-16%)\
__Bun:__ 20,0s (-25%)

Here I was just curious to check if all of this syntax sugar is actually slowing the code down, and yeah, turns out it could have quite a significant performance impact.

```js
function readLine(line) {
  const [city, value] = line.split(";");
  const temperature = parseFloat(value);
  const currentCity = results[city];
  if (currentCity) {
    currentCity.max = Math.max(currentCity.max, temperature);
    currentCity.min = Math.min(currentCity.min, temperature);
    currentCity.totalSum += temperature;
    currentCity.count++;
  } else {
    results[city] = {
      max: temperature,
      min: temperature,
      totalSum: temperature,
      count: 1,
    };
  }
}
```

### No Math.max / Math.min functions

__Node:__ 27,8s (-1%)\
__Bun:__ 20,0s (0%)

Here I just wanted to check if not using Math function would change anything. But yeah, pretty much no changes here.

```js
function readLine(line) {
  const [city, value] = line.split(";");
  let temperature = parseFloat(value);
    const currentCity = results[city];
    if (currentCity) {
      if (currentCity.max < temperature) {
        currentCity.max = temperature;
      }
      if (currentCity.min > temperature) {
        currentCity.min = temperature;
      }
      currentCity.totalSum += temperature;
      currentCity.count++;
    } else {
      results[city] = {
        max: temperature,
        min: temperature,
        totalSum: temperature,
        count: 1,
      };
    }
}
```

### Using typed array for storing results 

__Node:__ 19,2s (-31%)\
__Bun:__ 24,9s (+24%)

Here I thought that since JS Map or general Objects are allocating memory dynamically, it might be worthwhile to somehow preallocate the memory to hopefully get a speed-up. And yeah, it worked quite well for Node, not so much for Bun for some reason 🤷‍♂️.

```js
const citiesIds = new Map();
let citiesCount = 0;
const array = new Int16Array(4 * 10000);

function readLine(city, value) {
  const [city, value] = line.split(";");
  let temperature = parseInt(value) + parseInt(value[value.length - 1]);
  citiesCount++;
  const cityId = citiesIds.get(city);
  if (!cityId) {
    citiesIds.set(city, citiesCount);
    array[citiesCount * 4] = temperature;
    array[citiesCount * 4 + 1] = temperature;
    array[citiesCount * 4 + 2] = temperature;
    array[citiesCount * 4 + 3] = 1;
    citiesCount++;
  } else {
    let index = cityId * 4;
    if (array[index] < temperature) {
      array[index] = temperature;
    }
    if (array[index + 1] > temperature) {
      array[index + 1] = temperature;
    }
    array[index + 2] += temperature;
    array[index + 3]++;
  }
}
```

### Custom line splitting (Definitely a bad version)

__Node:__ 31,0s (+61%)\
__Bun:__ 34,8s (+40%)

I'm not proud of this one 😅. 
Garbage collection goes brrr. All of these string concatenations should be allocating new memory per each +=. So building strings this way in a loop would be quite inefficient.

```js
function lineSplit(line) {
  let city = "";
  let value = "";
  let recordingValue = false;
  for (let i = 0; i < line.length; i++) {
    if (line[i] === ";") {
      recordingValue = true;
      continue;
    }
    if (recordingValue) {
      value += line[i];
    } else {
      city += line[i];
    }
  }
  return [city, value];
}
```

### Custom line splitting but better

__Node:__ 29,2s (-6%)\
__Bun:__ 27,5s (-21%)

Now I've learned that to effectively split lines, I should be using Buffers, so the splitting becomes a little more complex.

We have potential here. Conversion of bytes to UTF-8 takes a lot of time; we potentially could save up to 50% here if only we could skip this nasty decoding on every line read somehow. Sadly we need to convert bytes to a string before using them as a key in the `results` object.

```js
const buffer = new Uint8Array(1024 * 512);
let bytesToRead = 0;
let bufferOffset = 0;
let filePosition = 0;

while (true) {
  const { bytesRead } = await file.read(
    buffer,
    bufferOffset, 
    buffer.length - bufferOffset,
    filePosition
  );
  bytesToRead = bytesRead;
  if (bytesRead === 0) {
    handleEnd();
    break;
  }

  readChunk();
  filePosition += bytesRead;
}

function readChunk() {
  let cityStart = 0;
  let semicolonIndex = -1;
  let readSize = bufferOffset + bytesToRead;

  for (let i = 0; i < readSize; i++) {
    if (buffer[i] === SEMICOLON_BYTE) {
      semicolonIndex = i;
    } else if (buffer[i] === LINE_BREAK_BYTE) {
      // Buffer is read and decoded to utf-8 in readLine function
      readLine(cityStart, semicolonIndex, semicolonIndex + 1, i);
      cityStart = i + 1;
    }
  }

  bufferOffset = 0;
  for (let i = cityStart; i < readSize; i++) {
    // copy leftovers to the beginning of the buffer
    buffer[bufferOffset++] = buffer[i];
  }
}
```


### Going insane. Making a custom hash map and skipping conversion to utf-8

__Node:__ 7,3s (-75%)\
__Bun:__ 8,8s (-68%)

_If in any real-life situation you’re going this far to optimize your Node application, take a deep breath and rethink your life choices._

In all honesty, it’s not worth doing anything similar in production as the chances of introducing bugs here are extremely high (I most definitely have some). But we are just having fun here, right? _…Right?_

At the moment, we have two main issues:

1. We can't use encoded bytes as keys for built-in Maps or Objects.
2. We can't preallocate memory for them either.
   
So, let's implement a custom hash map built on top of Typed Arrays (Buffers)!

Here's what we need to do:

1. Create a hashing function that takes a byte array (key) as input and returns an index in an array where we will store this key.
2. Once we have the index, save all final measurements in a separate array at the same index.
3. Finally, extract and convert keys to UTF-8 and retrieve all the measurement results. This process will be quite fast since we'll only do it once.

You can check the single thread code [here](https://gist.github.com/DNFcode/d3c6c17e92b2e55e39f72ba78c9da1eb)

### Parallelization

__Node:__ 1,5s (-80%)\
__Bun:__ 1,5s (-83%)

So finally, let's use workers!

1. Each worker can be quite independent from the rest. Since we're not using an SSD, it's possible to read the same file from multiple places at the same time. Therefore, we'll communicate to each worker a `toByte` and `fromByte` so they know which parts to process.
2. Since we can't perfectly align worker offsets with line breaks, each worker will skip the first line (except the worker starting with offset 0) and continue reading beyond `toByte` until reaching the end of a line. This way, we compensate for other workers skipping their first line.
3. Each worker will then retrieve information for cities in the part of the file it processes.
4. Finally, the main process will aggregate the data from each worker.

You can check the final version [here](https://gist.github.com/DNFcode/7e713a5c4561e0f2c6f38237b73ecfa1)


## The end

So finally I've reran the initial version and the final version with actual 1 billion rows and got __7m46s__ to run on single thread and __15 seconds__ for 10 workers.

What could be improved? 

- I kinda expected better performance from multithreading. Compared to the single-threaded version, it was only sped up by 5x (on 10 cores). Of course, there's going to be some overhead, but that seems a little too much??
- I didn't test everything thoroughly, so there could be bugs. But to be honest, I was doing it more for fun than precision 🤷‍♂️
- I definitely need to figure out how to properly profile Node. Profiling logs somehow were not showing everything to me, and it was hard to understand which built-in function calls waste the most CPU time.

