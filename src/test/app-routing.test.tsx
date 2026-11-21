import { QueryClient } from "@tanstack/react-query";
import { createRouter, rootRouteId } from "@tanstack/react-router";
import { describe, expect, it } from "vitest";

import { routeTree } from "@/routeTree.gen";
import { getMembershipClinicIds, readOptionalRows } from "@/lib/carepulse-staff-data";

// Match routes without running loaders or rendering: loaders may need a server or
// network the test run lacks, and jsdom never loads the stylesheets React waits on.
describe("App routing", () => {
  it("matches a page for / instead of falling back to not found", () => {
    const router = createRouter({ routeTree, context: { queryClient: new QueryClient() } });

    const matches = router.matchRoutes("/");

    expect(matches.at(-1)?.routeId).not.toBe(rootRouteId);
  });

  it("limits clinic data requests to unique clinic memberships", () => {
    expect(getMembershipClinicIds([
      { clinic_id: "clinic-a", role: "staff" },
      { clinic_id: "clinic-b", role: "doctor" },
      { clinic_id: "clinic-a", role: "staff" },
    ])).toEqual(["clinic-a", "clinic-b"]);
    expect(getMembershipClinicIds([])).toEqual([]);
  });

  it("keeps the workspace open when the database refuses doctor records", () => {
    const unavailable: string[] = [];
    expect(readOptionalRows("doctors", { data: null, error: { code: "42501" } }, unavailable)).toEqual([]);
    expect(unavailable).toEqual(["doctors"]);
    expect(readOptionalRows("doctor schedules", { data: [{ id: "s1" }], error: null }, unavailable)).toEqual([{ id: "s1" }]);
    expect(unavailable).toEqual(["doctors"]);
  });
});
