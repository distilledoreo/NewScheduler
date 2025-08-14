import React from "react";

export const ProfileContext = React.createContext<{ showProfile: (id: number) => void } | null>(null);

export default ProfileContext;
