import { Platform } from "react-native";

type ServiceMapProps = {
  latitude: number;
  longitude: number;
  label: string;
};

const ServiceMapImplementation = Platform.OS === "web"
  ? require("./service-map.web").ServiceMap
  : require("./service-map.native").ServiceMap;

export function ServiceMap(props: ServiceMapProps) {
  return <ServiceMapImplementation {...props} />;
}
