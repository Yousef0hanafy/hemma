"use server";

import { db } from "@/lib/db";
import bcrypt from "bcryptjs";
import { z } from "zod";

// ---------------------------------------------------------------------------
// Validation
// ---------------------------------------------------------------------------

const signupSchema = z.object({
  name: z.string().min(2, "الاسم يجب أن يكون حرفين على الأقل").max(50),
  email: z.string().email("البريد الإلكتروني غير صالح"),
  password: z
    .string()
    .min(6, "كلمة المرور يجب أن تكون ٦ أحرف على الأقل")
    .max(100),
});

export type SignupResult =
  | { success: true; userId: string }
  | { success: false; error: string };

// ---------------------------------------------------------------------------
// Signup
// ---------------------------------------------------------------------------

/**
 * Creates a new user account with email and password.
 * Returns an error if the email is already registered.
 */
export async function signupWithEmail(
  _prevState: SignupResult | null,
  formData: FormData
): Promise<SignupResult> {
  try {
    const raw = {
      name: formData.get("name") as string,
      email: formData.get("email") as string,
      password: formData.get("password") as string,
    };

    const parsed = signupSchema.safeParse(raw);
    if (!parsed.success) {
      const firstError = parsed.error.errors[0]?.message ?? "بيانات غير صحيحة";
      return { success: false, error: firstError };
    }

    const { name, email, password } = parsed.data;

    // Check if email already exists
    const existing = await db.user.findUnique({ where: { email } });
    if (existing) {
      // If the user has a password, they're already registered with credentials
      if (existing.password) {
        return { success: false, error: "هذا البريد مسجّل بالفعل. سجّل الدخول بدلاً من ذلك." };
      }
      // User exists via Google OAuth — tell them to use Google
      return {
        success: false,
        error: "هذا البريد مرتبط بحساب Google. الرجاء تسجيل الدخول باستخدام Google.",
      };
    }

    // Hash password and create user
    const hashedPassword = await bcrypt.hash(password, 12);
    const user = await db.user.create({
      data: {
        name,
        email,
        password: hashedPassword,
        role: "student",
      },
    });

    // Also create a UserProfile for the new user
    await db.userProfile.create({
      data: {
        userBucket: user.id,
        streakShields: 1,
      },
    });

    return { success: true, userId: user.id };
  } catch (error) {
    console.error("[Signup]", error);
    return { success: false, error: "حدث خطأ غير متوقع. حاول مرة أخرى." };
  }
}
