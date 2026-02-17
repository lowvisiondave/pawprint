import NextAuth from "next-auth"
import GitHub from "next-auth/providers/github"
import { neon } from "@neondatabase/serverless"

const sql = process.env.DATABASE_URL ? neon(process.env.DATABASE_URL) : null

export const { handlers, signIn, signOut, auth } = NextAuth({
  providers: [GitHub],
  callbacks: {
    async signIn({ user }) {
      if (!sql) return true
      
      // Check if user exists
      const existing = await sql`
        SELECT id FROM users WHERE github_id = ${user.id}
      `
      
      if (existing.length === 0) {
        // Create new user
        await sql`
          INSERT INTO users (email, name, avatar_url, github_id)
          VALUES (${user.email}, ${user.name}, ${user.image}, ${user.id})
        `
      }
      
      return true
    },
    async session({ session }) {
      if (!sql) return session
      
      // Get user from DB
      const users = await sql`
        SELECT id FROM users WHERE github_id = ${session.user?.id}
      `
      
      if (users.length > 0) {
        session.user.id = users[0].id.toString()
      }
      
      return session
    }
  }
})
