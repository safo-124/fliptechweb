// app/(admin)/(auth)/login/page.jsx
"use client"; // This directive is necessary for using React Hooks and event handlers

import { useState } from 'react';
import { useRouter } from 'next/navigation'; // For redirection
import { Button } from '@/components/ui/button'; // Assuming Shadcn UI setup
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardFooter, CardHeader, CardTitle } from '@/components/ui/card'; // For styling the form

export default function AdminLoginPage() {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (event) => {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    try {
      const response = await fetch('/api/auth/admin/login', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({ email, password }),
      });

      const data = await response.json();

      if (!response.ok) {
        throw new Error(data.error || 'Login failed. Please try again.');
      }

      // Login successful
      console.log('Login successful:', data);

      // Store the token (e.g., in localStorage - consider more secure options for production)
      // For web, HttpOnly cookies set by the server are often preferred.
      // If your API sets an HttpOnly cookie, you might not need to handle the token here.
      if (data.token) {
        localStorage.setItem('adminToken', data.token); // Simple storage for now
      }
      
      // You might want to store user info in a global state/context as well
      // localStorage.setItem('adminUser', JSON.stringify(data.user));


      // Redirect to the admin dashboard
      router.push('/dashboard'); // Assuming your admin dashboard is at /dashboard

    } catch (err) {
      setError(err.message);
      console.error('Login error:', err);
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="flex items-center justify-center min-h-screen bg-muted/40">
      <Card className="w-full max-w-sm">
        <CardHeader className="text-center">
          <CardTitle className="text-2xl">Admin Login</CardTitle>
          <CardDescription>Enter your credentials to access the dashboard.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-4">
            <div className="space-y-2">
              <Label htmlFor="email">Email</Label>
              <Input
                id="email"
                type="email"
                placeholder="admin@example.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            <div className="space-y-2">
              <Label htmlFor="password">Password</Label>
              <Input
                id="password"
                type="password"
                placeholder="••••••••"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                required
                disabled={isLoading}
              />
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <Button type="submit" className="w-full" disabled={isLoading}>
              {isLoading ? 'Logging in...' : 'Login'}
            </Button>
          </form>
        </CardContent>
        {/* Optional CardFooter for links like "Forgot password?" if needed later */}
        {/* <CardFooter>
          <p className="text-xs text-center text-muted-foreground">
            © {new Date().getFullYear()} Artisan Platform Ghana
          </p>
        </CardFooter> */}
      </Card>
    </div>
  );
}