import React, { useContext } from "react";
import { ProfileContext } from "./ProfileContext";

interface PersonNameProps {
  personId: number;
  children: React.ReactNode;
}

export default function PersonName({ personId, children }: PersonNameProps) {
  const ctx = useContext(ProfileContext);
  return (
    <span
      className="cursor-pointer text-blue-600 hover:underline"
      onClick={() => ctx?.showProfile(personId)}
    >
      {children}
    </span>
  );
}
