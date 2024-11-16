// db-service.ts
import type { Database, SqlJsStatic } from "sql.js";
import initSqlJs from "sql.js";

export interface Product {
  id: number;
  title: string;
  description: string;
  status: string;
  category: string;
  price: number;
  date: string;
}

type QueryResult = {
  columns: string[];
  values: unknown[][];
}[];

interface DatabaseState {
  db: Database | null;
  initialized: boolean;
  initializationPromise: Promise<void> | null;
}

const state: DatabaseState = {
  db: null,
  initialized: false,
  initializationPromise: null,
};

const sampleData: Omit<Product, "id">[] = [
  {
    title: "Winter Boots",
    description: "Comfortable winter boots for extreme cold",
    status: "in stock",
    category: "winter boots",
    price: 129.99,
    date: "2024-01-15",
  },
  {
    title: "Summer Sandals",
    description: "Light and breathable sandals for beach",
    status: "in stock",
    category: "summer shoes",
    price: 49.99,
    date: "2024-03-01",
  },
  {
    title: "Running Shoes Nike Air",
    description: "Professional running shoes with air cushioning",
    status: "low stock",
    category: "athletic shoes",
    price: 159.99,
    date: "2024-02-15",
  },
  {
    title: "Leather Boots",
    description: "Classic leather boots for all occasions",
    status: "out of stock",
    category: "boots",
    price: 199.99,
    date: "2023-12-01",
  },
  {
    title: "Hiking Boots",
    description: "Waterproof hiking boots for mountain terrain",
    status: "in stock",
    category: "outdoor boots",
    price: 179.99,
    date: "2024-01-20",
  },
  {
    title: "Dress Shoes Black",
    description: "Elegant black dress shoes for formal occasions",
    status: "in stock",
    category: "formal shoes",
    price: 149.99,
    date: "2024-02-01",
  },
  {
    title: "Canvas Sneakers",
    description: "Casual canvas sneakers for everyday wear",
    status: "in stock",
    category: "casual shoes",
    price: 39.99,
    date: "2024-03-10",
  },
  {
    title: "Kids Sport Shoes",
    description: "Durable sports shoes for active kids",
    status: "low stock",
    category: "children shoes",
    price: 49.99,
    date: "2024-02-20",
  },
];

export async function initialize(): Promise<void> {
  if (state.initialized) return;
  if (state.initializationPromise) return state.initializationPromise;

  state.initializationPromise = (async () => {
    const SQL: SqlJsStatic = await initSqlJs({
      locateFile: (file: string) => `https://sql.js.org/dist/${file}`,
    });

    state.db = new SQL.Database();

    // Create the products table
    state.db.run(`
      CREATE TABLE products (
        id INTEGER PRIMARY KEY,
        title TEXT,
        description TEXT,
        status TEXT,
        category TEXT,
        price REAL,
        date TEXT
      );
    `);

    const stmt = state.db.prepare(`
      INSERT INTO products (title, description, status, category, price, date)
      VALUES (?, ?, ?, ?, ?, ?);
    `);

    sampleData.forEach((product) => {
      stmt.run([
        product.title,
        product.description,
        product.status,
        product.category,
        product.price,
        product.date,
      ]);
    });

    stmt.free();
    state.initialized = true;
  })();

  return state.initializationPromise;
}

export async function executeQuery(
  sqlQuery: string,
  params: (string | number)[] = []
): Promise<Product[]> {
  await initialize();

  if (!state.db) {
    throw new Error("Database not initialized");
  }

  try {
    const results: QueryResult = state.db.exec(sqlQuery, params);

    if (!results || results.length === 0) {
      return [];
    }

    const columns = results[0].columns;
    return results[0].values.map((row) => {
      const product = columns.reduce<Record<string, unknown>>(
        (acc, col, index) => ({
          ...acc,
          [col]: row[index],
        }),
        {}
      );

      return {
        id: Number(product.id),
        title: String(product.title),
        description: String(product.description),
        status: String(product.status),
        category: String(product.category),
        price: Number(product.price),
        date: String(product.date),
      };
    });
  } catch (error) {
    if (error instanceof Error) {
      throw new Error(`Database query error: ${error.message}`);
    }
    throw new Error("Unknown database error occurred");
  }
}

export async function searchProducts(
  whereClause: string,
  params: (string | number)[] = []
): Promise<Product[]> {
  const query = `
    SELECT *
    FROM products
    WHERE ${whereClause || "1=1"}
  `;
  const result = await executeQuery(query, params);
  return result;
}
