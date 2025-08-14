import React, { useContext } from "react";
import { Link } from "@fluentui/react-components";
import { ProfileContext } from "./ProfileContext";

interface PersonNameProps {
  personId: number;
  children: React.ReactNode;
}

export default function PersonName({ personId, children }: PersonNameProps) {
  const ctx = useContext(ProfileContext);
  return (
    <Link onClick={() => ctx?.showProfile(personId)} appearance="subtle">
      {children}
    </Link>
  );
}
