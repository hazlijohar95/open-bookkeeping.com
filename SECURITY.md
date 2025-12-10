# Security Policy

## Supported Versions

We release patches for security vulnerabilities for the following versions:

| Version | Supported          |
| ------- | ------------------ |
| 1.x.x   | :white_check_mark: |

## Reporting a Vulnerability

We take the security of Open Bookkeeping seriously. If you believe you have found a security vulnerability, please report it to us as described below.

### Please Do

- **Report the vulnerability privately** - Do not create a public GitHub issue
- **Provide details** - Include steps to reproduce, impact assessment, and any relevant technical details
- **Allow time for response** - We aim to respond within 48 hours
- **Keep the vulnerability confidential** until we've addressed it

### Please Don't

- **Don't publicly disclose** the vulnerability before we've had a chance to fix it
- **Don't exploit** the vulnerability beyond what's necessary to demonstrate it
- **Don't access or modify** other users' data

## How to Report

Send your report to: **security@open-bookkeeping.com**

Alternatively, you can use [GitHub's private vulnerability reporting](https://github.com/open-bookkeeping/open-bookkeeping/security/advisories/new) feature.

Include the following information:
- Type of vulnerability (e.g., XSS, SQL injection, authentication bypass)
- Full paths of affected source file(s)
- Location of the affected code (tag/branch/commit or direct URL)
- Step-by-step instructions to reproduce
- Proof-of-concept or exploit code (if possible)
- Impact assessment

## What to Expect

1. **Acknowledgment**: We will acknowledge receipt within 48 hours
2. **Assessment**: We will assess the vulnerability and determine its severity
3. **Resolution**: We will work on a fix and keep you informed of progress
4. **Disclosure**: Once fixed, we will coordinate disclosure with you
5. **Credit**: We will credit you in our security advisories (unless you prefer to remain anonymous)

## Security Best Practices for Users

### Environment Variables

- Never commit `.env` files to version control
- Rotate credentials regularly
- Use strong, unique values for secrets

### Deployment

- Always use HTTPS in production
- Keep dependencies updated
- Enable security headers
- Use proper CORS configuration

### Database

- Use parameterized queries (Drizzle ORM handles this)
- Implement proper access controls
- Regular backups with encryption

### Authentication

- Supabase handles authentication securely
- Implement proper session management
- Use secure cookie settings

## Security Updates

Security updates will be released as:
- Patch versions for minor issues
- Minor versions for significant issues
- Immediate patches for critical issues

Subscribe to our releases to stay informed about security updates.

## Scope

This security policy applies to:
- The Open Bookkeeping application code
- Our official documentation
- Our official deployment configurations

This policy does not cover:
- Third-party services we integrate with (Supabase, Netlify, etc.)
- User-deployed instances with custom modifications

## Hall of Fame

We appreciate the security researchers who help keep Open Bookkeeping secure. With their permission, we recognize their contributions here.

---

Thank you for helping keep Open Bookkeeping and our users safe!
