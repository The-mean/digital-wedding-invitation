# Secure User Authentication System

A secure authentication system built with Node.js, Express, and MySQL, featuring JWT authentication and password reset functionality.

## Features

- User registration with password hashing
- User login with JWT authentication
- Password reset via email
- Input validation and sanitization
- Protection against SQL injection
- CORS enabled
- Secure password storage using bcrypt
- JWT-based authentication middleware
- Email-based password reset flow

## Prerequisites

- Node.js (v14 or higher)
- MySQL (v5.7 or higher)
- SMTP server access for sending emails

## Setup

1. Clone the repository:
```bash
git clone <repository-url>
cd <project-directory>
```

2. Install dependencies:
```bash
npm install
```

3. Create a `.env` file in the root directory with the following variables:
```
DB_HOST=localhost
DB_USER=your_mysql_username
DB_PASSWORD=your_mysql_password
DB_NAME=auth_db
JWT_SECRET=your_jwt_secret_key
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=your_email@gmail.com
SMTP_PASS=your_app_password
```

4. Set up the database:
- Log in to MySQL
- Run the SQL commands in `database.sql`

5. Start the server:
```bash
node app.js
```

## API Endpoints

### Public Routes

- `POST /api/register` - Register a new user
  - Body: `{ "email": "user@example.com", "password": "Password123", "name": "John Doe" }`

- `POST /api/login` - Login user
  - Body: `{ "email": "user@example.com", "password": "Password123" }`

- `POST /api/request-reset` - Request password reset
  - Body: `{ "email": "user@example.com" }`

- `POST /api/reset-password` - Reset password
  - Body: `{ "token": "reset_token", "password": "NewPassword123" }`

### Protected Routes

- `GET /api/profile` - Get user profile (requires authentication)
  - Header: `Authorization: Bearer <jwt_token>`

## Security Features

- Password hashing using bcrypt
- JWT for stateless authentication
- Input validation and sanitization
- SQL injection protection
- CORS enabled
- Secure password reset flow
- Rate limiting (TODO)
- Request validation middleware

## Error Handling

The API returns appropriate HTTP status codes and error messages:

- 200: Success
- 201: Resource created
- 400: Bad request
- 401: Unauthorized
- 404: Not found
- 500: Server error

## Contributing

1. Fork the repository
2. Create your feature branch
3. Commit your changes
4. Push to the branch
5. Create a new Pull Request 