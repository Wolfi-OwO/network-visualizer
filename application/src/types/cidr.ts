// CIDR / subnet calculation types.

export interface CIDRResult {
  input: string;
  ipAddress: string;
  cidrPrefix: number;
  networkAddress: string;
  broadcastAddress: string;
  firstHost: string;
  lastHost: string;
  subnetMask: string;
  wildcardMask: string;
  totalHosts: number;
  usableHosts: number;
  binarySubnetMask: string;
  binaryNetworkAddress: string;
  binaryIpAddress: string;
  ipClass: string;
  isPrivate: boolean;
  octets: number[];
  networkOctets: number[];
  broadcastOctets: number[];
}

export interface SubnetRequest {
  network: string;
  count?: number;
  prefixLength?: number;
}

export interface SupernetRequest {
  networks: string[];
}
