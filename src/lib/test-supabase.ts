import { db } from "@/db/drizzle";

export async function testSupabaseConnection() {
  try {
    // We'll try to fetch a single row from the specifications table
    const testQuery = await db.query.specifications.findFirst();

    if (testQuery) {
      console.log("✅ Supabase connection successful");
      return true;
    } else {
      console.log("ℹ️ Connected to Supabase, but no records found");
      return true;
    }
  } catch (error) {
    console.error("❌ Supabase connection failed:", error);
    return false;
  }
}
