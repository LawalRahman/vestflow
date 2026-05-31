import { getClaimable, getSchedule, NETWORK } from "@/lib/stellar";
import { NextRequest, NextResponse } from "next/server";

export async function GET(
  request: NextRequest,
  { params }: { params: { id: string } }
): Promise<NextResponse> {
  try {
    const scheduleId = parseInt(params.id, 10);
    
    if (isNaN(scheduleId)) {
      return NextResponse.json(
        { error: "Invalid schedule ID" },
        { status: 400 }
      );
    }

    // Fetch schedule from contract
    const schedule = await getSchedule(scheduleId);
    
    if (!schedule) {
      return NextResponse.json(
        { error: "Schedule not found" },
        { status: 404 }
      );
    }

    // Fetch claimable amount
    const claimable = await getClaimable(scheduleId);

    return NextResponse.json(
      {
        schedule,
        claimable: claimable.toString(),
        network: NETWORK,
      },
      {
        headers: {
          "Cache-Control": "public, max-age=30, stale-while-revalidate=300",
        },
      }
    );
  } catch (error) {
    console.error("Error fetching schedule:", error);
    return NextResponse.json(
      { error: "Failed to fetch schedule" },
      { status: 500 }
    );
  }
}
