import HomeClient from "@/components/HomeClient";

// Server component — reads OWNER_MODE without NEXT_PUBLIC_ prefix.
// The value is passed as a prop to the client component so the browser
// never needs to read env vars directly.
export default function Page() {
  const ownerMode = process.env.OWNER_MODE === "true";
  return <HomeClient ownerMode={ownerMode} />;
}
