import { Link } from "react-router-dom";
import { useAuthStore } from "../store/useAuthStore";
import { useChatStore } from "../store/useChatStore";
import { LogOut, Settings, User, Menu, PanelLeftClose } from "lucide-react";

const Navbar = () => {
  const { logout, authUser } = useAuthStore();
  const { toggleSidebar, isSidebarOpen } = useChatStore();

  return (
    <header
      className="bg-base-100 border-b border-base-300 fixed w-full top-0 z-40 
    backdrop-blur-lg bg-base-100/80"
    >
      <div className="container mx-auto px-4 h-16">
        <div className="flex items-center justify-between h-full">
          <div className="flex items-center gap-4">
            {authUser && (
              <button
                type="button"
                className="btn btn-ghost btn-sm lg:hidden"
                onClick={toggleSidebar}
                aria-label={isSidebarOpen ? "Hide contacts" : "Show contacts"}
              >
                {isSidebarOpen ? <PanelLeftClose className="size-5" /> : <Menu className="size-5" />}
              </button>
            )}
            <Link to="/" className="flex items-center gap-2.5 hover:opacity-80 transition-all">
              <img src="/favicon1.png" alt="Cryptogram logo" className="w-8 h-8 object-contain" />
              <h1 className="text-lg font-bold">Cryptogram</h1>
            </Link>
          </div>

          <div className="flex items-center gap-3">
            {authUser && (
              <div className="hidden sm:flex flex-col text-right">
                <span className="text-[10px] uppercase tracking-wide text-zinc-500">
                  Logged in as
                </span>
                <span
                  className="text-sm font-semibold max-w-[10rem] truncate"
                  title={authUser.fullName || authUser.email}
                >
                  {authUser.fullName || authUser.email}
                </span>
              </div>
            )}

            <Link
              to={"/settings"}
              className={`
              btn btn-sm gap-2 transition-colors
              
              `}
            >
              <Settings className="w-4 h-4" />
              <span className="hidden sm:inline">Settings</span>
            </Link>

            {authUser && (
              <>
                <Link to={"/profile"} className={`btn btn-sm gap-2`}>
                  <User className="size-5" />
                  <span className="hidden sm:inline">Profile</span>
                </Link>

                <button className="flex gap-2 items-center" onClick={logout}>
                  <LogOut className="size-5" />
                  <span className="hidden sm:inline">Logout</span>
                </button>
              </>
            )}
          </div>
        </div>
      </div>
    </header>
  );
};
export default Navbar;
