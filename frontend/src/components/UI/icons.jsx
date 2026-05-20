import { HugeiconsIcon } from "@hugeicons/react";
import {
  Alert02Icon,
  Analytics01Icon,
  ArrowDown01Icon,
  ArrowLeft01Icon,
  Calendar03Icon,
  Cancel01Icon,
  CarAlertIcon,
  ChartBarBigIcon,
  CheckmarkCircle02Icon,
  Clock03Icon,
  CloudIcon,
  DashboardSquare01Icon,
  Database01Icon,
  Delete02Icon,
  Download01Icon,
  FileDownloadIcon,
  Globe02Icon,
  Image01Icon,
  InformationCircleIcon,
  Login03Icon,
  LockKeyIcon,
  Logout03Icon,
  Mail01Icon,
  MapPinIcon,
  PhoneCheckIcon,
  PlusSignIcon,
  Refresh01Icon,
  Search01Icon,
  Settings02Icon,
  ShieldUserIcon,
  SparklesIcon,
  Upload01Icon,
  UserIcon,
} from "@hugeicons/core-free-icons";

function createIcon(icon) {
  return function Icon({
    size = 20,
    color = "currentColor",
    strokeWidth = 1.7,
    ...props
  }) {
    return (
      <HugeiconsIcon
        icon={icon}
        size={size}
        color={color}
        strokeWidth={strokeWidth}
        {...props}
      />
    );
  };
}

export const AlertTriangle = createIcon(Alert02Icon);
export const BarChart3 = createIcon(ChartBarBigIcon);
export const Calendar = createIcon(Calendar03Icon);
export const CalendarDays = createIcon(Calendar03Icon);
export const Check = createIcon(CheckmarkCircle02Icon);
export const ChevronDown = createIcon(ArrowDown01Icon);
export const ChevronLeft = createIcon(ArrowLeft01Icon);
export const Clock3 = createIcon(Clock03Icon);
export const Cloud = createIcon(CloudIcon);
export const Database = createIcon(Database01Icon);
export const Download = createIcon(Download01Icon);
export const FileDown = createIcon(FileDownloadIcon);
export const Globe2 = createIcon(Globe02Icon);
export const Image = createIcon(Image01Icon);
export const Info = createIcon(InformationCircleIcon);
export const LayoutDashboard = createIcon(DashboardSquare01Icon);
export const LogIn = createIcon(Login03Icon);
export const Lock = createIcon(LockKeyIcon);
export const LogOut = createIcon(Logout03Icon);
export const Mail = createIcon(Mail01Icon);
export const MapPin = createIcon(MapPinIcon);
export const Phone = createIcon(PhoneCheckIcon);
export const Plus = createIcon(PlusSignIcon);
export const RefreshCw = createIcon(Refresh01Icon);
export const Search = createIcon(Search01Icon);
export const Settings = createIcon(Settings02Icon);
export const ShieldAlert = createIcon(CarAlertIcon);
export const ShieldCheck = createIcon(ShieldUserIcon);
export const Sparkles = createIcon(SparklesIcon);
export const Trash2 = createIcon(Delete02Icon);
export const TriangleAlert = createIcon(Alert02Icon);
export const Upload = createIcon(Upload01Icon);
export const User = createIcon(UserIcon);
export const X = createIcon(Cancel01Icon);
export const Analytics = createIcon(Analytics01Icon);
