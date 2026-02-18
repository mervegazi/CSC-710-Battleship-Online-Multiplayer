import { useState, useEffect } from "react";
import { Link, useNavigate } from "react-router";
import { useAuth } from "../hooks/useAuth";
import { getAuthErrorMessage } from "../contexts/AuthContext";
import { AuthLayout } from "../components/common/AuthLayout";
import { Input } from "../components/common/Input";
import { Button } from "../components/common/Button";
import type { AuthError } from "@supabase/supabase-js";

interface FieldErrors {
  displayName?: string;
  email?: string;
  password?: string;
  confirmPassword?: string;
}

export function RegisterPage() {
  const { user, signUp } = useAuth();
  const navigate = useNavigate();

  const [displayName, setDisplayName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [errors, setErrors] = useState<FieldErrors>({});
  const [generalError, setGeneralError] = useState("");
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (user) navigate("/lobby", { replace: true });
  }, [user, navigate]);

  const validate = (): boolean => {
    const next: FieldErrors = {};

    const name = displayName.trim();
    if (!name) {
      next.displayName = "Display name is required.";
    } else if (name.length < 3 || name.length > 20) {
      next.displayName = "Display name must be 3-20 characters.";
    }

    if (!email.trim()) {
      next.email = "Email is required.";
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
      next.email = "Please enter a valid email address.";
    }

    if (!password) {
      next.password = "Password is required.";
    } else if (password.length < 6) {
      next.password = "Password must be at least 6 characters.";
    }

    if (password !== confirmPassword) {
      next.confirmPassword = "Passwords do not match.";
    }

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setGeneralError("");

    if (!validate()) return;

    setSubmitting(true);
    try {
      await signUp(email.trim(), password, displayName.trim());
      navigate("/lobby", { replace: true });
    } catch (err) {
      const msg = getAuthErrorMessage(err as AuthError);

      // Route specific errors to the relevant field
      const lower = msg.toLowerCase();
      if (lower.includes("email")) {
        setErrors((prev) => ({ ...prev, email: msg }));
      } else if (lower.includes("display name")) {
        setErrors((prev) => ({ ...prev, displayName: msg }));
      } else if (lower.includes("password")) {
        setErrors((prev) => ({ ...prev, password: msg }));
      } else {
        setGeneralError(msg);
      }
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <AuthLayout title="Create Account" subtitle="Join the battle">
      <form onSubmit={handleSubmit} className="flex flex-col gap-4">
        {generalError && (
          <div className="rounded-lg bg-red-500/10 px-4 py-3 text-sm text-red-400">
            {generalError}
          </div>
        )}

        <Input
          label="Display Name"
          type="text"
          placeholder="Captain_Hook"
          value={displayName}
          onChange={(e) => setDisplayName(e.target.value)}
          error={errors.displayName}
          autoComplete="username"
        />

        <Input
          label="Email"
          type="email"
          placeholder="you@example.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          error={errors.email}
          autoComplete="email"
        />

        <Input
          label="Password"
          type="password"
          placeholder="At least 6 characters"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          error={errors.password}
          autoComplete="new-password"
        />

        <Input
          label="Confirm Password"
          type="password"
          placeholder="Repeat your password"
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          error={errors.confirmPassword}
          autoComplete="new-password"
        />

        <Button type="submit" isLoading={submitting} fullWidth>
          Create Account
        </Button>

        <p className="text-center text-sm text-slate-400">
          Already have an account?{" "}
          <Link
            to="/login"
            className="font-medium text-blue-400 hover:text-blue-300"
          >
            Sign in
          </Link>
        </p>
      </form>
    </AuthLayout>
  );
}
