import logo from '../assets/erp-logo-light.png';

/** Same mark in light and dark; PNG is bundled for reliable deploy URLs. */
export default function ErpLogo({ className = 'h-9 w-9 shrink-0 rounded-lg' }) {
  return <img src={logo} alt="" width={36} height={36} className={className} />;
}
