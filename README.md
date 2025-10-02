# Budgetix - Personal Finance Manager

Budgetix is a modern, full-stack personal finance management application that helps you track expenses, manage budgets, and gain insights into your spending habits.

## Features

- 📊 Expense tracking and categorization
- 📅 Monthly budget planning
- 📈 Financial overview and analytics
- 🔐 Secure user authentication
- 📱 Responsive design for all devices
- 🔄 Recurring expenses management
- 🧾 Receipt scanning with OCR (Optical Character Recognition)

## Tech Stack

### Frontend
- React.js with Vite
- Tailwind CSS for styling
- React Router for navigation
- Axios for API requests

### Backend
- Node.js with Express
- Supabase for database and authentication
- RESTful API architecture

## Getting Started

### Prerequisites
- Node.js (v16 or later)
- npm or yarn
- Supabase account

### Installation

1. Clone the repository:
   ```bash
   git clone https://github.com/yourusername/budgetix.git
   cd budgetix
   ```

2. Install server dependencies:
   ```bash
   cd server
   npm install
   ```

3. Install client dependencies:
   ```bash
   cd ../client
   npm install
   ```

4. Set up environment variables:
   - Create `.env` files in both `client` and `server` directories
   - Add your Supabase credentials and other environment variables

### Running the Application

1. Start the server:
   ```bash
   cd server
   npm start
   ```

2. In a new terminal, start the client:
   ```bash
   cd client
   npm run dev
   ```

3. Open your browser and navigate to `http://localhost:5173`

## Project Structure

```
budgetix/
├── client/                 # Frontend React application
│   ├── src/
│   │   ├── components/    # Reusable UI components
│   │   ├── utils/         # Utility functions
│   │   └── App.jsx        # Main application component
│   └── ...
├── server/                # Backend server
│   ├── controllers/       # Route controllers
│   ├── routes/           # API routes
│   ├── services/         # Business logic
│   └── ...
└── ...
```

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Acknowledgments

- Thanks to all contributors who have helped shape this project.
- Built with ❤️ using modern web technologies.
