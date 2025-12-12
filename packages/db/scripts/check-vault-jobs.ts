import { db, vaultProcessingJobs } from "../src/index";
import { desc } from "drizzle-orm";

async function check() {
  // Get recent processing jobs
  const jobs = await db
    .select({
      id: vaultProcessingJobs.id,
      status: vaultProcessingJobs.status,
      extractedData: vaultProcessingJobs.extractedData,
      errorMessage: vaultProcessingJobs.errorMessage,
      createdAt: vaultProcessingJobs.createdAt,
    })
    .from(vaultProcessingJobs)
    .orderBy(desc(vaultProcessingJobs.createdAt))
    .limit(5);

  console.log("Recent processing jobs:", jobs.length);
  for (const job of jobs) {
    console.log("---");
    console.log("Status:", job.status);
    console.log("Error:", job.errorMessage ?? "none");
    console.log("Created:", job.createdAt);
    const hasData = job.extractedData ? true : false;
    console.log("Has extracted data:", hasData);
    if (job.extractedData) {
      const data = JSON.parse(job.extractedData);
      console.log("Extracted vendor:", data?.vendor?.name ?? "none");
      console.log("Extracted total:", data?.total ?? "none");
    }
  }
  process.exit(0);
}
check();
