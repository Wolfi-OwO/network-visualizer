// The text search engines and people read before any script runs. It lives in one file because the server prerenders it
// into index.html (the SPA's shell is empty otherwise) and the client renders the same words on the CIDR page, so the
// two cannot drift apart. No imports: the client bundles this file too.

export const ORIGIN = 'https://netviz.woofi-developments.at';

export interface PageMeta {
  title: string;
  description: string;
  heading: string;
  intro: string;
}

/** The public routes of src/router.tsx that are content (sign-in, admin and account are not). */
export const PAGES: Record<string, PageMeta> = {
  '/': {
    title: 'NetViz: Network Designer, Packet Simulator and CIDR Calculator',
    description:
      'Design and simulate enterprise networks in your browser: drag-and-drop topology builder, live packet capture and a free CIDR subnet calculator. No install.',
    heading: 'NetViz, a network designer in your browser',
    intro:
      'Draw routers, switches and hosts on a canvas, send simulated packets across the topology, watch live packet capture and work out subnets with the built-in CIDR calculator.',
  },
  '/network': {
    title: 'Network Topology Builder: Draw and Simulate Networks | NetViz',
    description:
      'Drag routers, switches and hosts onto a canvas, connect them, assign addresses and simulate traffic. Free network topology builder that runs in your browser.',
    heading: 'Network topology builder',
    intro:
      'Build a topology by dragging devices onto the canvas and connecting them. Give each interface an address, then send packets to see how they travel.',
  },
  '/packets': {
    title: 'Packet Capture and Simulator in the Browser | NetViz',
    description:
      'Send simulated packets across your own topology and follow them hop by hop in a live capture view. Learn how routing and switching behave without a lab.',
    heading: 'Packet capture and simulator',
    intro:
      'Craft a packet, send it from one device to another and follow it through every hop in the live capture view.',
  },
  '/cidr': {
    title: 'CIDR Calculator: Subnet Mask, Hosts, Range and Wildcard | NetViz',
    description:
      'Free CIDR and subnet calculator: network and broadcast address, usable host range, subnet and wildcard mask for any IPv4 block. Split into subnets or find the supernet.',
    heading: 'CIDR calculator',
    intro:
      'Enter an IPv4 address with a prefix, such as 192.168.10.0/26, to get the network address, broadcast address, usable host range, subnet mask, wildcard mask and the number of hosts. Split the block into smaller subnets or combine blocks into one supernet.',
  },
};

export interface GuideSection {
  heading: string;
  paragraphs: string[];
}

export interface Faq {
  question: string;
  answer: string;
}

export interface PrefixRow {
  prefix: string;
  mask: string;
  addresses: string;
  usable: string;
}

/** Counts are 2^(32 - prefix) addresses; a /31 has two usable ones (RFC 3021) and a /32 names a single host. */
export const PREFIX_TABLE: PrefixRow[] = [
  { prefix: '/8', mask: '255.0.0.0', addresses: '16,777,216', usable: '16,777,214' },
  { prefix: '/16', mask: '255.255.0.0', addresses: '65,536', usable: '65,534' },
  { prefix: '/24', mask: '255.255.255.0', addresses: '256', usable: '254' },
  { prefix: '/25', mask: '255.255.255.128', addresses: '128', usable: '126' },
  { prefix: '/26', mask: '255.255.255.192', addresses: '64', usable: '62' },
  { prefix: '/27', mask: '255.255.255.224', addresses: '32', usable: '30' },
  { prefix: '/28', mask: '255.255.255.240', addresses: '16', usable: '14' },
  { prefix: '/29', mask: '255.255.255.248', addresses: '8', usable: '6' },
  { prefix: '/30', mask: '255.255.255.252', addresses: '4', usable: '2' },
  { prefix: '/31', mask: '255.255.255.254', addresses: '2', usable: '2 (point-to-point)' },
  { prefix: '/32', mask: '255.255.255.255', addresses: '1', usable: '1 (single host)' },
];

export const CIDR_GUIDE: GuideSection[] = [
  {
    heading: 'What CIDR notation means',
    paragraphs: [
      'CIDR (Classless Inter-Domain Routing) writes a block of IPv4 addresses as an address followed by a slash and a prefix length, for example 192.168.10.0/26. The prefix length is the number of leading bits that are fixed and shared by every address in the block; the remaining bits count the hosts. A /26 fixes 26 bits and leaves 6, so the block holds 2^6 = 64 addresses.',
      'The same information can be written as a subnet mask: /26 is 255.255.255.192, because 26 one-bits followed by six zero-bits read as 255.255.255.192 in dotted form. The wildcard mask is the opposite, 0.0.0.63, and is what access lists on many routers expect.',
    ],
  },
  {
    heading: 'A worked example: 192.168.10.0/26',
    paragraphs: [
      'The network address is 192.168.10.0 and the broadcast address is 192.168.10.63. The usable hosts run from 192.168.10.1 to 192.168.10.62, which is 62 addresses, because the first address names the network and the last one is the broadcast.',
      'Splitting 192.168.10.0/24 into four /26 subnets gives 192.168.10.0, 192.168.10.64, 192.168.10.128 and 192.168.10.192, each with 62 usable hosts. Each step of the split adds one bit to the prefix and halves the block.',
    ],
  },
  {
    heading: 'Private and special ranges',
    paragraphs: [
      'RFC 1918 reserves three blocks for private networks: 10.0.0.0/8 (10.0.0.0 to 10.255.255.255), 172.16.0.0/12 (172.16.0.0 to 172.31.255.255) and 192.168.0.0/16. They are not routed on the public internet.',
      'Other blocks worth recognising: 100.64.0.0/10 is shared address space for carrier-grade NAT, 169.254.0.0/16 is link-local (what a host gives itself when DHCP fails), and 192.0.2.0/24, 198.51.100.0/24 and 203.0.113.0/24 are set aside for documentation and examples.',
    ],
  },
];

export const CIDR_FAQ: Faq[] = [
  {
    question: 'How many usable hosts does a /24 have?',
    answer:
      'A /24 has 256 addresses and 254 usable hosts, because the network address and the broadcast address cannot be given to a device.',
  },
  {
    question: 'How do I calculate the number of hosts from a prefix length?',
    answer:
      'Compute 2 to the power of (32 minus the prefix length) for the total number of addresses, then subtract two for the network and broadcast addresses. For /26 that is 2^6 = 64 addresses and 62 usable hosts.',
  },
  {
    question: 'What is a wildcard mask?',
    answer:
      'A wildcard mask is the inverse of the subnet mask: every bit that the subnet mask fixes is 0 and every host bit is 1. For 255.255.255.192 the wildcard mask is 0.0.0.63. Access lists and routing protocol statements on many routers use it.',
  },
  {
    question: 'Can a /31 or /32 be used?',
    answer:
      'A /31 holds two addresses and is used on point-to-point links with no network or broadcast address (RFC 3021). A /32 names exactly one host and is typically used for loopback addresses and host routes.',
  },
  {
    question: 'How do I split a network into smaller subnets?',
    answer:
      'Add bits to the prefix: each extra bit doubles the number of subnets and halves the size of each. Splitting a /24 into four subnets means moving to /26. The calculator on this page lists every resulting subnet with its range.',
  },
];
