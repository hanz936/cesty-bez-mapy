# Documentation Index

Welcome to the Cesty bez mapy technical documentation.

---

## 📋 Available Documentation

### Implementation Plans

#### [Custom Itinerary Implementation Plan](CUSTOM_ITINERARY_IMPLEMENTATION.md)
**Status:** ✅ Ready for Implementation (Frontend NOT yet implemented)
**Version:** 2.1 (Data Migration Safety + Status Clarification)
**Last Updated:** 2026-01-10

Complete implementation guide for the custom itinerary feature including:
- Database schema and migrations
- Supabase configuration (anonymous auth, CAPTCHA)
- Frontend implementation (React components)
- Admin panel setup
- User workflows
- Security & RLS policies
- Testing checklist
- Deployment steps

**Key Topics:**
- Guest checkout with anonymous authentication
- HTML to PDF conversion via window.print()
- Post-purchase account creation
- Automated customer lifecycle management

---

### Architecture Decisions

#### [Architecture Decision Records (ADR)](ARCHITECTURE_DECISIONS.md)
**Last Updated:** 2026-01-10

Documentation of critical architectural decisions made during development:

- **ADR-001:** Use Anonymous Authentication Instead of `anon` Role
- **ADR-002:** Use `auth_user_id` Column for RLS (CRITICAL FIX)
- **ADR-003:** Automate Customer Lifecycle with Database Triggers
- **ADR-004:** Use HTML + window.print() for PDF Generation
- **ADR-005:** Use Cloudflare Turnstile for CAPTCHA
- **ADR-006:** Simplify Navigation (No useTransition)
- **ADR-007:** Post-Purchase Account Creation (Optional)

Each ADR includes:
- Context and problem statement
- Decision rationale
- Consequences (positive and negative)
- Alternatives considered
- References to documentation

---

## 🗂️ Related Documentation

### Root-Level Documentation

- **[../ROADMAP.md](../ROADMAP.md)** - Project roadmap and feature planning
- **[../TECH_STACK.md](../TECH_STACK.md)** - Technology stack details
- **[../README.md](../README.md)** - Main project README with setup instructions

### Database

- **[../supabase/migrations/](../supabase/migrations/)** - Database migration files
  - `011_link_custom_requests_to_orders.sql`
  - `012_custom_requests_rls.sql` (CORRECTED with auth_user_id)
  - `013_customers_auth_sync.sql` (NEW - triggers)

---

## 🎯 Quick Links by Role

### For Developers

1. Start here: [Custom Itinerary Implementation Plan](CUSTOM_ITINERARY_IMPLEMENTATION.md)
2. Understand why: [Architecture Decisions](ARCHITECTURE_DECISIONS.md)
3. Check migrations: [../supabase/migrations/](../supabase/migrations/)

### For Architects

1. Review decisions: [Architecture Decisions](ARCHITECTURE_DECISIONS.md)
2. Understand data flow: [Custom Itinerary Implementation - Architecture](CUSTOM_ITINERARY_IMPLEMENTATION.md#architecture)
3. Check security: [Custom Itinerary Implementation - Security & RLS](CUSTOM_ITINERARY_IMPLEMENTATION.md#security--rls)

### For QA/Testers

1. Test cases: [Custom Itinerary Implementation - Testing](CUSTOM_ITINERARY_IMPLEMENTATION.md#testing)
2. User workflows: [Custom Itinerary Implementation - User Workflows](CUSTOM_ITINERARY_IMPLEMENTATION.md#user-workflows)

### For DevOps

1. Deployment: [Custom Itinerary Implementation - Deployment](CUSTOM_ITINERARY_IMPLEMENTATION.md#deployment)
2. Configuration: [Custom Itinerary Implementation - Supabase Configuration](CUSTOM_ITINERARY_IMPLEMENTATION.md#supabase-configuration)

---

## 📝 Document Conventions

### Status Labels

- ✅ **Accepted** - Decision approved and implemented
- ⚠️ **Proposed** - Under review
- ❌ **Rejected** - Decision rejected with reasons
- 🔄 **Superseded** - Replaced by newer decision

### Version Numbers

Documentation follows semantic versioning:
- **Major (2.0):** Significant architecture changes
- **Minor (2.1):** Feature additions
- **Patch (2.0.1):** Bug fixes or clarifications

---

## 🔍 Critical Fixes Documented

This documentation includes several **critical fixes** that were identified during implementation audit:

### 1. Schema Mismatch Fix (CRITICAL)
**Problem:** Original RLS policies used `customer_id = auth.uid()` which failed because these are different UUIDs.

**Solution:** Added `auth_user_id` column that directly references `auth.users.id` for RLS policies.

**Document:** [ADR-002](ARCHITECTURE_DECISIONS.md#adr-002-use-auth_user_id-column-for-rls-instead-of-customer_id)

### 2. Customer Lifecycle Automation (HIGH)
**Problem:** No mechanism to automatically create customer records when users sign up or upgrade from anonymous.

**Solution:** Database triggers with SECURITY DEFINER functions.

**Document:** [ADR-003](ARCHITECTURE_DECISIONS.md#adr-003-automate-customer-lifecycle-with-database-triggers)

### 3. CAPTCHA Protection (HIGH)
**Problem:** Anonymous sign-ins vulnerable to abuse without CAPTCHA.

**Solution:** Cloudflare Turnstile in invisible mode.

**Document:** [ADR-005](ARCHITECTURE_DECISIONS.md#adr-005-use-cloudflare-turnstile-for-captcha)

---

## 📚 External References

### Supabase Documentation
- [Anonymous Sign-Ins](https://supabase.com/docs/guides/auth/auth-anonymous)
- [User Management](https://supabase.com/docs/guides/auth/managing-user-data)
- [Row Level Security](https://supabase.com/docs/guides/database/postgres/row-level-security)
- [PostgreSQL Triggers](https://supabase.com/docs/guides/database/postgres/triggers)

### Cloudflare Documentation
- [Turnstile Overview](https://developers.cloudflare.com/turnstile/)
- [Widget Configurations](https://developers.cloudflare.com/turnstile/get-started/client-side-rendering/widget-configurations/)

### React Documentation
- [useTransition](https://react.dev/reference/react/useTransition)
- [React Router](https://reactrouter.com/)

---

## 🤝 Contributing to Documentation

When adding new documentation:

1. **Create ADR for architectural decisions** (use ARCHITECTURE_DECISIONS.md as template)
2. **Update this index** with links to new documents
3. **Follow naming convention:** `FEATURE_NAME_TYPE.md` (e.g., `CUSTOM_ITINERARY_IMPLEMENTATION.md`)
4. **Include version and date** in document header
5. **Add references** to external documentation

---

**Documentation Version:** 1.0
**Last Updated:** 2026-01-10
**Maintained by:** Development Team
