export type LanguageCategory = 'Systems' | 'Scripting' | 'Web & Mobile' | 'Data & Query';

export interface CodeExample {
  title: string;
  description: string;
  code: string;
}

export interface LanguageSpec {
  id: string;
  name: string;
  shortCode: string;
  filename: string;
  category: LanguageCategory;
  paradigm: string;
  tagline: string;
  defaultCode: string;
  examples: CodeExample[];
}

export const LANGUAGES: LanguageSpec[] = [
  {
    id: 'python',
    name: 'Python',
    shortCode: 'PY',
    filename: 'main.py',
    category: 'Scripting',
    paradigm: 'Interpreted · Dynamic',
    tagline: 'Expressive general-purpose computing and algorithmic clarity.',
    defaultCode: `def fibonacci(n: int) -> list[int]:
    seq = [0, 1]
    for _ in range(2, n):
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

nums = fibonacci(10)
print("Fibonacci (10):", nums)
print("Sum:", sum(nums), "| Mean:", round(sum(nums) / len(nums), 2))
`,
    examples: [
      {
        title: 'Fibonacci & Stats',
        description: 'Generate sequence and compute summary metrics.',
        code: `def fibonacci(n: int) -> list[int]:
    seq = [0, 1]
    for _ in range(2, n):
        seq.append(seq[-1] + seq[-2])
    return seq[:n]

nums = fibonacci(10)
print("Fibonacci (10):", nums)
print("Sum:", sum(nums), "| Mean:", round(sum(nums) / len(nums), 2))
`,
      },
      {
        title: 'Quick Sort',
        description: 'Divide-and-conquer recursive sorting.',
        code: `def quicksort(arr):
    if len(arr) <= 1:
        return arr
    pivot = arr[len(arr) // 2]
    left = [x for x in arr if x < pivot]
    mid = [x for x in arr if x == pivot]
    right = [x for x in arr if x > pivot]
    return quicksort(left) + mid + quicksort(right)

data = [42, 7, 19, 3, 88, 15, 23, 1]
print("Input :", data)
print("Sorted:", quicksort(data))
`,
      },
    ],
  },
  {
    id: 'javascript',
    name: 'JavaScript',
    shortCode: 'JS',
    filename: 'index.js',
    category: 'Web & Mobile',
    paradigm: 'JIT · Event-Driven',
    tagline: 'Modern ECMAScript execution powered by Node.js V8.',
    defaultCode: `const orders = [
  { item: 'Keyboard', qty: 2, price: 149 },
  { item: 'Monitor', qty: 1, price: 599 },
  { item: 'Cable', qty: 4, price: 18 },
];

const total = orders.reduce((acc, o) => acc + o.qty * o.price, 0);
for (const o of orders) {
  console.log(\`\${o.item.padEnd(10)} x\${o.qty}  $\${o.qty * o.price}\`);
}
console.log('-------------------');
console.log(\`Total Revenue: $\${total}\`);
`,
    examples: [
      {
        title: 'Order Ledger',
        description: 'Map and reduce structured records.',
        code: `const orders = [
  { item: 'Keyboard', qty: 2, price: 149 },
  { item: 'Monitor', qty: 1, price: 599 },
  { item: 'Cable', qty: 4, price: 18 },
];

const total = orders.reduce((acc, o) => acc + o.qty * o.price, 0);
for (const o of orders) {
  console.log(\`\${o.item.padEnd(10)} x\${o.qty}  $\${o.qty * o.price}\`);
}
console.log('-------------------');
console.log(\`Total Revenue: $\${total}\`);
`,
      },
      {
        title: 'Prime Sieve',
        description: 'Sieve of Eratosthenes up to 50.',
        code: `function sieve(limit) {
  const isPrime = Array(limit + 1).fill(true);
  isPrime[0] = isPrime[1] = false;
  for (let p = 2; p * p <= limit; p++) {
    if (isPrime[p]) {
      for (let m = p * p; m <= limit; m += p) isPrime[m] = false;
    }
  }
  return isPrime.flatMap((ok, i) => (ok ? [i] : []));
}

console.log('Primes <= 50:', sieve(50).join(', '));
`,
      },
    ],
  },
  {
    id: 'typescript',
    name: 'TypeScript',
    shortCode: 'TS',
    filename: 'main.ts',
    category: 'Web & Mobile',
    paradigm: 'Typed · Transpiled',
    tagline: 'Statically typed JavaScript transpiled and executed cleanly.',
    defaultCode: `interface Metric {
  label: string;
  value: number;
  unit: string;
}

function summarize(metrics: Metric[]): void {
  for (const m of metrics) {
    console.log(\`\${m.label.padEnd(14)} -> \${m.value.toFixed(1)} \${m.unit}\`);
  }
}

summarize([
  { label: 'Throughput', value: 1420.5, unit: 'req/s' },
  { label: 'P95 Latency', value: 18.24, unit: 'ms' },
  { label: 'Cache Hit', value: 98.7, unit: '%' },
]);
`,
    examples: [
      {
        title: 'Typed Metrics',
        description: 'Interface-constrained formatting pipeline.',
        code: `interface Metric {
  label: string;
  value: number;
  unit: string;
}

function summarize(metrics: Metric[]): void {
  for (const m of metrics) {
    console.log(\`\${m.label.padEnd(14)} -> \${m.value.toFixed(1)} \${m.unit}\`);
  }
}

summarize([
  { label: 'Throughput', value: 1420.5, unit: 'req/s' },
  { label: 'P95 Latency', value: 18.24, unit: 'ms' },
  { label: 'Cache Hit', value: 98.7, unit: '%' },
]);
`,
      },
      {
        title: 'Generic Stack',
        description: 'Type-safe generic LIFO data structure.',
        code: `class Stack<T> {
  private items: T[] = [];
  push(item: T): void { this.items.push(item); }
  pop(): T | undefined { return this.items.pop(); }
  peek(): T | undefined { return this.items[this.items.length - 1]; }
  size(): number { return this.items.length; }
}

const stack = new Stack<string>();
stack.push('alpha');
stack.push('beta');
stack.push('gamma');
console.log('Top:', stack.peek(), '| Size:', stack.size());
console.log('Popped:', stack.pop());
console.log('Remaining size:', stack.size());
`,
      },
    ],
  },
  {
    id: 'java',
    name: 'Java',
    shortCode: 'JV',
    filename: 'Main.java',
    category: 'Systems',
    paradigm: 'OOP · Static Typed',
    tagline: 'Structured object-oriented classes and algorithms.',
    defaultCode: `public class Main {
    public static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        int[] values = {3, 5, 7, 9};
        for (int v : values) {
            System.out.printf("factorial(%d) = %d\\n", v, factorial(v));
        }
    }
}
`,
    examples: [
      {
        title: 'Recursive Factorial',
        description: 'Static recursion with printf formatting.',
        code: `public class Main {
    public static int factorial(int n) {
        if (n <= 1) return 1;
        return n * factorial(n - 1);
    }

    public static void main(String[] args) {
        int[] values = {3, 5, 7, 9};
        for (int v : values) {
            System.out.printf("factorial(%d) = %d\\n", v, factorial(v));
        }
    }
}
`,
      },
      {
        title: 'Array Sort',
        description: 'In-place array sorting and traversal.',
        code: `import java.util.Arrays;

public class Main {
    public static void main(String[] args) {
        int[] scores = {91, 64, 88, 72, 99, 55};
        Arrays.sort(scores);
        System.out.println("Sorted scores: " + Arrays.toString(scores));
    }
}
`,
      },
    ],
  },
  {
    id: 'csharp',
    name: 'C#',
    shortCode: 'C#',
    filename: 'Program.cs',
    category: 'Systems',
    paradigm: 'Managed · .NET',
    tagline: 'Clean C# syntax with string interpolation and collections.',
    defaultCode: `using System;
using System.Collections.Generic;

class Program {
    static int Fib(int n) {
        if (n <= 1) return n;
        return Fib(n - 1) + Fib(n - 2);
    }

    static void Main() {
        var results = new List<int>();
        for (int i = 0; i < 8; i++) {
            results.Add(Fib(i));
        }
        Console.WriteLine($"Count: {results.Count}");
        foreach (var val in results) {
            Console.Write($"{val} ");
        }
        Console.WriteLine("");
    }
}
`,
    examples: [
      {
        title: 'Fibonacci List',
        description: 'List collection with string interpolation.',
        code: `using System;
using System.Collections.Generic;

class Program {
    static int Fib(int n) {
        if (n <= 1) return n;
        return Fib(n - 1) + Fib(n - 2);
    }

    static void Main() {
        var results = new List<int>();
        for (int i = 0; i < 8; i++) {
            results.Add(Fib(i));
        }
        Console.WriteLine($"Count: {results.Count}");
        foreach (var val in results) {
            Console.Write($"{val} ");
        }
        Console.WriteLine("");
    }
}
`,
      },
      {
        title: 'Circle Geometry',
        description: 'Math computations across radii.',
        code: `using System;

class Program {
    static void Main() {
        double[] radii = { 1.5, 3.0, 5.2 };
        foreach (var r in radii) {
            double area = Math.PI * Math.Pow(r, 2);
            Console.WriteLine($"r={r} -> area={Math.Round(area, 2)}");
        }
    }
}
`,
      },
    ],
  },
  {
    id: 'c',
    name: 'C',
    shortCode: 'C',
    filename: 'main.c',
    category: 'Systems',
    paradigm: 'Procedural · Low-Level',
    tagline: 'Classic C procedural logic, loops, and printf formatting.',
    defaultCode: `#include <stdio.h>
#include <math.h>

int gcd(int a, int b) {
    while (b != 0) {
        int temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

int main() {
    printf("GCD(48, 18) = %d\\n", gcd(48, 18));
    for (int i = 1; i <= 5; i++) {
        printf("sqrt(%d) = %.3f\\n", i, sqrt(i));
    }
    return 0;
}
`,
    examples: [
      {
        title: 'Euclidean GCD',
        description: 'Iterative GCD and square root table.',
        code: `#include <stdio.h>
#include <math.h>

int gcd(int a, int b) {
    while (b != 0) {
        int temp = b;
        b = a % b;
        a = temp;
    }
    return a;
}

int main() {
    printf("GCD(48, 18) = %d\\n", gcd(48, 18));
    for (int i = 1; i <= 5; i++) {
        printf("sqrt(%d) = %.3f\\n", i, sqrt(i));
    }
    return 0;
}
`,
      },
      {
        title: 'Array Statistics',
        description: 'Iterate fixed array for sum and average.',
        code: `#include <stdio.h>

int main() {
    int nums[] = {12, 24, 36, 48, 60};
    int n = sizeof(nums) / sizeof(nums[0]);
    int sum = 0;
    for (int i = 0; i < n; i++) {
        sum += nums[i];
    }
    printf("Count: %d | Sum: %d | Avg: %.1f\\n", n, sum, (double)sum / n);
    return 0;
}
`,
      },
    ],
  },
  {
    id: 'cpp',
    name: 'C++',
    shortCode: 'C++',
    filename: 'main.cpp',
    category: 'Systems',
    paradigm: 'Multi-Paradigm · STL',
    tagline: 'Vectors, algorithms, and stream output in modern C++.',
    defaultCode: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> values = {34, 12, 89, 5, 27};
    values.push_back(42);
    std::sort(values.begin(), values.end());

    std::cout << "Sorted (" << values.size() << "): ";
    for (auto v : values) {
        std::cout << v << " ";
    }
    std::cout << std::endl;
    return 0;
}
`,
    examples: [
      {
        title: 'Vector Sort',
        description: 'Sort dynamic vector and stream output.',
        code: `#include <iostream>
#include <vector>
#include <algorithm>

int main() {
    std::vector<int> values = {34, 12, 89, 5, 27};
    values.push_back(42);
    std::sort(values.begin(), values.end());

    std::cout << "Sorted (" << values.size() << "): ";
    for (auto v : values) {
        std::cout << v << " ";
    }
    std::cout << std::endl;
    return 0;
}
`,
      },
      {
        title: 'Power Table',
        description: 'Compute powers using a helper function.',
        code: `#include <iostream>

long long power(int base, int exp) {
    long long res = 1;
    for (int i = 0; i < exp; i++) res *= base;
    return res;
}

int main() {
    for (int e = 0; e <= 6; e++) {
        std::cout << "2^" << e << " = " << power(2, e) << std::endl;
    }
    return 0;
}
`,
      },
    ],
  },
  {
    id: 'rust',
    name: 'Rust',
    shortCode: 'RS',
    filename: 'main.rs',
    category: 'Systems',
    paradigm: 'Memory-Safe · Zero-Cost',
    tagline: 'Iterators, ranges, and crisp macro formatting.',
    defaultCode: `fn square(x: i32) -> i32 {
    return x * x;
}

fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6];
    let squares: Vec<i32> = nums.iter().map(|x| x * x).collect();
    let total: i32 = squares.iter().sum();

    println!("Input:   {:?}", nums);
    println!("Squares: {:?}", squares);
    println!("Sum:     {}", total);
    println!("7^2 =    {}", square(7));
}
`,
    examples: [
      {
        title: 'Iterator Pipeline',
        description: 'Map and sum vectors with println! macros.',
        code: `fn square(x: i32) -> i32 {
    return x * x;
}

fn main() {
    let nums = vec![1, 2, 3, 4, 5, 6];
    let squares: Vec<i32> = nums.iter().map(|x| x * x).collect();
    let total: i32 = squares.iter().sum();

    println!("Input:   {:?}", nums);
    println!("Squares: {:?}", squares);
    println!("Sum:     {}", total);
    println!("7^2 =    {}", square(7));
}
`,
      },
      {
        title: 'Range Loop',
        description: 'Inclusive and exclusive ranges.',
        code: `fn main() {
    let mut sum = 0;
    for i in 1..=10 {
        sum += i;
    }
    println!("Sum 1..=10 = {}", sum);
}
`,
      },
    ],
  },
  {
    id: 'go',
    name: 'Go',
    shortCode: 'GO',
    filename: 'main.go',
    category: 'Systems',
    paradigm: 'Compiled · Concurrent',
    tagline: 'Minimalist syntax, slices, and clean fmt output.',
    defaultCode: `package main

import "fmt"

func sumSlice(nums []int) int {
    total := 0
    for _, v := range nums {
        total += v
    }
    return total
}

func main() {
    scores := []int{18, 24, 31, 45, 12}
    scores = append(scores, 50)
    fmt.Println("Scores:", scores)
    fmt.Printf("Count: %d | Total: %d\\n", len(scores), sumSlice(scores))
}
`,
    examples: [
      {
        title: 'Slice Aggregation',
        description: 'Range iteration, append, and fmt.Printf.',
        code: `package main

import "fmt"

func sumSlice(nums []int) int {
    total := 0
    for _, v := range nums {
        total += v
    }
    return total
}

func main() {
    scores := []int{18, 24, 31, 45, 12}
    scores = append(scores, 50)
    fmt.Println("Scores:", scores)
    fmt.Printf("Count: %d | Total: %d\\n", len(scores), sumSlice(scores))
}
`,
      },
      {
        title: 'Fibonacci Loop',
        description: 'Iterative Fibonacci generator.',
        code: `package main

import "fmt"

func main() {
    a, b := 0, 1
    for i := 0; i < 10; i++ {
        fmt.Printf("%d ", a)
        next := a + b
        a = b
        b = next
    }
    fmt.Println("")
}
`,
      },
    ],
  },
  {
    id: 'swift',
    name: 'Swift',
    shortCode: 'SW',
    filename: 'main.swift',
    category: 'Web & Mobile',
    paradigm: 'Safe · Expressive',
    tagline: 'Clean value semantics, ranges, and string interpolation.',
    defaultCode: `func factorial(_ n: Int) -> Int {
    if n <= 1 { return 1 }
    return n * factorial(n - 1)
}

let numbers = [4, 6, 8, 10]
for n in numbers {
    print("\\(n)! = \\(factorial(n))")
}

var sum = 0
for i in 1...5 {
    sum += i
}
print("Triangular(5) = \\(sum)")
`,
    examples: [
      {
        title: 'Interpolation & Ranges',
        description: 'Recursive functions and closed ranges.',
        code: `func factorial(_ n: Int) -> Int {
    if n <= 1 { return 1 }
    return n * factorial(n - 1)
}

let numbers = [4, 6, 8, 10]
for n in numbers {
    print("\\(n)! = \\(factorial(n))")
}

var sum = 0
for i in 1...5 {
    sum += i
}
print("Triangular(5) = \\(sum)")
`,
      },
    ],
  },
  {
    id: 'kotlin',
    name: 'Kotlin',
    shortCode: 'KT',
    filename: 'Main.kt',
    category: 'Web & Mobile',
    paradigm: 'Concise · JVM & Multiplatform',
    tagline: 'Concise collection transforms and string templates.',
    defaultCode: `fun isEven(n: Int): Boolean {
    return n % 2 == 0
}

fun main() {
    val nums = listOf(3, 8, 15, 22, 9, 14)
    val evens = nums.filter { it % 2 == 0 }
    println("All numbers: $nums")
    println("Even numbers: $evens")
    println("Sum of evens: \${evens.sum()}")
}
`,
    examples: [
      {
        title: 'Collection Filters',
        description: 'Functional list processing in Kotlin.',
        code: `fun isEven(n: Int): Boolean {
    return n % 2 == 0
}

fun main() {
    val nums = listOf(3, 8, 15, 22, 9, 14)
    val evens = nums.filter { it % 2 == 0 }
    println("All numbers: $nums")
    println("Even numbers: $evens")
    println("Sum of evens: \${evens.sum()}")
}
`,
      },
    ],
  },
  {
    id: 'dart',
    name: 'Dart',
    shortCode: 'DT',
    filename: 'main.dart',
    category: 'Web & Mobile',
    paradigm: 'Client-Optimized · Typed',
    tagline: 'Clean type inference, arrow functions, and lists.',
    defaultCode: `int doubleIt(int x) => x * 2;

void main() {
  final values = [2, 5, 9, 12];
  final doubled = values.map(doubleIt).toList();
  print('Original: $values');
  print('Doubled:  $doubled');

  var total = 0;
  for (var v in doubled) {
    total += v;
  }
  print('Total:    $total');
}
`,
    examples: [
      {
        title: 'Arrow Functions & Lists',
        description: 'Functional mapping with Dart lists.',
        code: `int doubleIt(int x) => x * 2;

void main() {
  final values = [2, 5, 9, 12];
  final doubled = values.map(doubleIt).toList();
  print('Original: $values');
  print('Doubled:  $doubled');

  var total = 0;
  for (var v in doubled) {
    total += v;
  }
  print('Total:    $total');
}
`,
      },
    ],
  },
  {
    id: 'php',
    name: 'PHP',
    shortCode: 'PHP',
    filename: 'index.php',
    category: 'Scripting',
    paradigm: 'Server-Side · Dynamic',
    tagline: 'Associative arrays, string interpolation, and helpers.',
    defaultCode: `<?php
$prices = ["Notebook" => 12.50, "Pen" => 3.25, "Lamp" => 44.00];
$total = 0;

foreach ($prices as $item => $cost) {
    printf("%-10s $%.2f\\n", $item, $cost);
    $total += $cost;
}

echo "Total: $" . number_format($total, 2) . "\\n";
?>
`,
    examples: [
      {
        title: 'Associative Ledger',
        description: 'Foreach key-value iteration and formatting.',
        code: `<?php
$prices = ["Notebook" => 12.50, "Pen" => 3.25, "Lamp" => 44.00];
$total = 0;

foreach ($prices as $item => $cost) {
    printf("%-10s $%.2f\\n", $item, $cost);
    $total += $cost;
}

echo "Total: $" . ($total) . "\\n";
?>
`,
      },
    ],
  },
  {
    id: 'ruby',
    name: 'Ruby',
    shortCode: 'RB',
    filename: 'main.rb',
    category: 'Scripting',
    paradigm: 'Object-Oriented · Expressive',
    tagline: 'Readable blocks, ranges, and expressive iterators.',
    defaultCode: `def greet(name)
  return "Hello, #{name}!"
end

puts greet("Kanso")

squares = []
(1..6).each do |n|
  squares.push(n * n)
end

puts "Squares: #{squares}"
puts "Sum: #{squares.sum}"
`,
    examples: [
      {
        title: 'Ranges & Blocks',
        description: 'Expressive range iteration and string interpolation.',
        code: `def greet(name)
  return "Hello, #{name}!"
end

puts greet("Kanso")

squares = []
(1..6).each do |n|
  squares.push(n * n)
end

puts "Squares: #{squares}"
puts "Sum: #{squares.sum}"
`,
      },
    ],
  },
  {
    id: 'sql',
    name: 'SQL',
    shortCode: 'SQL',
    filename: 'query.sql',
    category: 'Data & Query',
    paradigm: 'Relational · SQLite 3',
    tagline: 'Full in-memory SQLite engine with structured table grids.',
    defaultCode: `CREATE TABLE engineers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  commits INTEGER NOT NULL
);

INSERT INTO engineers (name, team, commits) VALUES
  ('Aoi Tanaka', 'Core Runtime', 148),
  ('Liam Brooks', 'Design Systems', 94),
  ('Maya Patel', 'Core Runtime', 176),
  ('Noah Lind', 'Query Engine', 122),
  ('Elena Rostova', 'Design Systems', 110);

SELECT
  team,
  COUNT(*) AS members,
  SUM(commits) AS total_commits,
  ROUND(AVG(commits), 1) AS avg_commits
FROM engineers
GROUP BY team
ORDER BY total_commits DESC;
`,
    examples: [
      {
        title: 'Team Aggregation',
        description: 'Create table, seed records, and aggregate.',
        code: `CREATE TABLE engineers (
  id INTEGER PRIMARY KEY,
  name TEXT NOT NULL,
  team TEXT NOT NULL,
  commits INTEGER NOT NULL
);

INSERT INTO engineers (name, team, commits) VALUES
  ('Aoi Tanaka', 'Core Runtime', 148),
  ('Liam Brooks', 'Design Systems', 94),
  ('Maya Patel', 'Core Runtime', 176),
  ('Noah Lind', 'Query Engine', 122),
  ('Elena Rostova', 'Design Systems', 110);

SELECT
  team,
  COUNT(*) AS members,
  SUM(commits) AS total_commits,
  ROUND(AVG(commits), 1) AS avg_commits
FROM engineers
GROUP BY team
ORDER BY total_commits DESC;
`,
      },
      {
        title: 'Window Ranking',
        description: 'Use SQLite CTE and DENSE_RANK window function.',
        code: `CREATE TABLE sales (region TEXT, rep TEXT, revenue REAL);
INSERT INTO sales VALUES
  ('APAC', 'Kenji', 84000),
  ('APAC', 'Sora', 91500),
  ('EMEA', 'Claire', 79000),
  ('EMEA', 'Marcus', 88200);

SELECT
  region,
  rep,
  revenue,
  RANK() OVER (PARTITION BY region ORDER BY revenue DESC) AS region_rank
FROM sales
ORDER BY region, region_rank;
`,
      },
    ],
  },
  {
    id: 'r',
    name: 'R',
    shortCode: 'R',
    filename: 'analysis.R',
    category: 'Data & Query',
    paradigm: 'Statistical · Vectorized',
    tagline: 'Vectors, descriptive statistics, and clean numerical output.',
    defaultCode: `samples <- c(14.2, 18.6, 15.9, 21.4, 17.8, 19.1, 16.5)

cat("Sample count:", length(samples), "\\n")
cat("Mean:        ", round(mean(samples), 2), "\\n")
cat("Median:      ", median(samples), "\\n")
cat("Std Dev:     ", round(sd(samples), 3), "\\n")

sorted_vals <- sort(samples)
print(sorted_vals)
`,
    examples: [
      {
        title: 'Descriptive Stats',
        description: 'Mean, median, standard deviation, and sorting.',
        code: `samples <- c(14.2, 18.6, 15.9, 21.4, 17.8, 19.1, 16.5)

cat("Sample count:", length(samples), "\\n")
cat("Mean:        ", round(mean(samples), 2), "\\n")
cat("Median:      ", median(samples), "\\n")
cat("Std Dev:     ", round(sd(samples), 3), "\\n")

sorted_vals <- sort(samples)
print(sorted_vals)
`,
      },
    ],
  },
  {
    id: 'matlab',
    name: 'MATLAB',
    shortCode: 'MAT',
    filename: 'matrix.m',
    category: 'Data & Query',
    paradigm: 'Matrix · Numerical',
    tagline: 'Matrices, linear ranges, and scientific computation.',
    defaultCode: `A = [1 2 3; 4 5 6; 7 8 9]
t = linspace(0, 10, 5);
disp("Linspace (0..10, 5):")
disp(t)

v = [12 18 24 30];
fprintf("Mean = %.2f | Std = %.2f\\n", mean(v), std(v));
`,
    examples: [
      {
        title: 'Matrix & Linspace',
        description: '2D matrices, linspace vectors, and fprintf.',
        code: `A = [1 2 3; 4 5 6; 7 8 9]
t = linspace(0, 10, 5);
disp("Linspace (0..10, 5):")
disp(t)

v = [12 18 24 30];
fprintf("Mean = %.2f | Std = %.2f\\n", mean(v), std(v));
`,
      },
    ],
  },
];

export const LANGUAGE_MAP = Object.fromEntries(LANGUAGES.map((l) => [l.id, l]));
