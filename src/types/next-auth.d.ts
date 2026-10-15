import type { DefaultSession } from "next-auth";
import type { Role } from "@/lib/users";

// next-auth re-exports Session/User/JWT as type aliases from @auth/core, so
// augmenting "next-auth" itself does not merge with the real interfaces -
// the augmentation has to target the @auth/core modules directly.
declare module "@auth/core/types" {
  interface Session {
    user: {
      id: string;
      role: Role;
    } & DefaultSession["user"];
  }

  interface User {
    role?: Role;
  }
}

declare module "@auth/core/jwt" {
  interface JWT {
    role?: Role;
  }
}
