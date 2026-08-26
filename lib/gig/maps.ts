/**
 * A deployed Android binary must have a Google Maps key before react-native-maps
 * mounts its Google provider. Keeping this decision separate makes booking safe
 * while Maps setup is intentionally pending.
 */
export function shouldRenderNativeGoogleMap(apiKey: string | undefined): boolean {
  return Boolean(apiKey?.trim());
}
