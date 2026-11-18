import { GraduationCap } from "lucide-react";
import Link from "next/link";
export function Brand() {
  return <Link href="/" className="brand" aria-label="CETI, início"><span className="brand-mark"><GraduationCap size={24} strokeWidth={1.7} /></span><span>CETI<span className="brand-description">Plataforma escolar</span></span></Link>;
}
