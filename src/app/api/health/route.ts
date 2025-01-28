import { testSupabaseConnection } from "@/lib/test-supabase";
import { NextResponse } from "next/server";

export async function GET() {
  try {
    const result = await testSupabaseConnection();
    return NextResponse.json(result);
  } catch (error) {
    return NextResponse.json(
      { status: "error", message: String(error) },
      { status: 500 }
    );
  }
}
