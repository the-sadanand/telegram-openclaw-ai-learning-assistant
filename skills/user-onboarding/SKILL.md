# User Onboarding

The runtime implementation is in `app.js`. This file documents the current behavior; it is not loaded as executable instructions.

## Profile storage

Profiles are stored through `lib/memory.js` using the key:

`user:<telegram-user-id>`

Production uses Upstash Redis when both Upstash environment variables are configured. Local development can fall back to file storage.

## Flow

1. `/start` welcomes a new user and asks for their name.
2. The user provides an experience level: Beginner, Intermediate, or Advanced.
3. The user provides comma-separated technical interests.
4. The user provides a timezone such as `IST` or `Asia/Kolkata`.
5. The profile is marked `onboarded: true`.
6. `DAILY_BRIEF_TIME` controls the daily brief time.

The bot asks one onboarding question at a time and validates the timezone before completion.

## Stored fields

`name`, `level`, `interests`, `timezone`, `onboarding_step`, `onboarded`, `editing_field`, `created_at`, and `last_brief_date`.

Do not use the old `user_profile_{{user.id}}` or `memory_store` terminology in new code.
