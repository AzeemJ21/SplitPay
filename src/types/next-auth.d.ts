import "next-auth";

declare module "next-auth" {
  interface Session {
    user: {
      id: string;
      name: string;
      email: string;
      splitCode: string;
      roles: string[];
    };
  }

  interface User {
    id: string;
    splitCode: string;
    roles: string[];
  }
}

declare module "next-auth/jwt" {
  interface JWT {
    id: string;
    splitCode: string;
    roles: string[];
  }
}
