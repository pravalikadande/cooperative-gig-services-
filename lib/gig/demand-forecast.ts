import type { Booking, DemandForecast, WorkerProfile } from "./models";

/**
 * Deterministic fallback used by the federation dashboard when no AI forecast snapshot exists.
 * It intentionally consumes aggregate booking fields only and never returns customer contact data.
 */
export function buildDemandForecast(bookings: Booking[], workers: WorkerProfile[], area = "All service areas"): Omit<DemandForecast, "id" | "generatedAt"> {
  const scoped = bookings.filter((booking) => area === "All service areas" || booking.location.address.toLowerCase().includes(area.toLowerCase()));
  const serviceCounts = new Map<string, number>();
  scoped.forEach((booking) => serviceCounts.set(booking.serviceName, (serviceCounts.get(booking.serviceName) ?? 0) + 1));
  const [serviceId, count] = [...serviceCounts.entries()].sort((left, right) => right[1] - left[1])[0] ?? ["general", 0];
  const urgentCount = scoped.filter((booking) => booking.priority === "emergency").length;
  const predictedJobs = count === 0 ? 0 : Math.max(count + urgentCount, Math.ceil(count * 1.2));
  const recommendedWorkerIds = workers
    .filter((worker) => worker.isOnline && (!worker.isEmergencyAvailable || urgentCount === 0))
    .sort((left, right) => right.rating - left.rating)
    .slice(0, 5)
    .map((worker) => worker.userId);
  return {
    serviceId,
    area,
    period: "Next 7 days",
    predictedJobs,
    recommendedWorkerIds,
    confidence: count >= 5 ? 0.82 : count > 0 ? 0.58 : 0.2,
    source: "rules",
  };
}
