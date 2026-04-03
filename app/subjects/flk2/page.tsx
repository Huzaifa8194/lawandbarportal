"use client";

import PortalShell from "../../components/portal-shell";
import SubjectsList from "../../components/subjects-list";

export default function Flk2SubjectsPage() {
  return (
    <PortalShell
      title="FLK2 Subjects"
      subtitle="Showing only FLK 2 subjects."
    >
      <SubjectsList track="FLK 2" />
    </PortalShell>
  );
}
