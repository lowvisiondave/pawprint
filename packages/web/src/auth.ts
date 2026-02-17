import NextAuth from "next-auth"
import GitHubProvider from "next-auth/providers/github"
import { neon } from "@neondatabase/serverless"

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

declare module "next-auth" {
  interface Session {
    user: {
      id?: string
      name?: string | null
      email?: string | null
      image?: string | null
    }
  }
}

const authOptions = {
  providers: [
    GitHubProvider({
      clientId: process.env.GITHUB_ID || '',
      clientSecret: process.env.GITHUB_SECRET || '',
    })
  ],
  callbacks: {
    async signIn({ user }: { user: any }) {
      if (!sql) return true
      
      const existing = await sql`
        SELECT id FROM users WHERE github_id = ${user.id}
      `
      
      if (existing.length === 0) {
        await sql`
          INSERT INTO users (email, name, avatar_url, github_id)
          VALUES (${user.email}, ${user.name}, ${user.image}, ${user.id})
        `
      }
      
      return true
    },
    async session({ session }: { session: any }) {
      if (!sql || !session.user?.email) return session
      
      const users = await sql`
        SELECT id FROM users WHERE email = ${session.user.email}
      `
      
      if (users.length > 0) {
        session.user.id = users[0].id.toString()
      }
      
      return session
    }
  }
}

export const auth = NextAuth(authOptions)

export { auth as GET, auth as POST }
