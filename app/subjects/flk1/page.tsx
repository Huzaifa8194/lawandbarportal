"use client";

import PortalShell from "../../components/portal-shell";
import SubjectsList from "../../components/subjects-list";

export default function Flk1SubjectsPage() {
  return (
    <PortalShell
      title="FLK1 Subjects"
      subtitle="Showing only FLK 1 subjects."
    >
      <SubjectsList track="FLK 1" />
    </PortalShell>
  );
}
