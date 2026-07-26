// Turns any free-text venue/address into ready-to-tap Google Maps links.
// Deliberately doesn't set an origin — Maps fills in "your location"
// automatically on the device that opens the link, which is what most
// people actually want (directions from wherever they are right now).
export function directionsUrl(destination: string, mode: "driving" | "transit"): string {
  const dest = encodeURIComponent(destination.trim());
  return `https://www.google.com/maps/dir/?api=1&destination=${dest}&travelmode=${mode}`;
}
