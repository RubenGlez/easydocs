# EasyDocs

EasyDocs is an AI-powered API documentation generator that automatically creates and maintains OpenAPI/Swagger documentation by analyzing API requests and responses in real-time.

## Features

- 🤖 AI-Powered Documentation: Leverages to LLMs to automatically generate accurate API documentation
- 🔄 Real-time Documentation Updates: Captures and processes live API traffic to keep documentation current
- 📊 OpenAPI 3.0 Compliance: Generates standard-compliant OpenAPI specifications
- 🌐 Swagger UI Integration: Built-in visualization of your API documentation
- 🗄️ PostgreSQL Storage: Persistent storage of API specifications
- 🔄 Smart Updates: Intelligently updates existing endpoint documentation while maintaining historical context

## Installation

1. Clone the repository
2. Install dependencies:

```bash
pnpm install
```

3. Set up your environment variables:

```bash
cp .env.example .env
```

4. Run the development server:

```bash
pnpm dev
```

## Documentation

### How It Works

1. **Proxy Setup**: EasyDocs acts as a proxy between your client and API server
2. **Request Capture**: Intercepts API requests and responses
3. **AI Processing**: Analyzes the captured data using LLMs to generate OpenAPI specifications
4. **Storage**: Stores the documentation in PostgreSQL
5. **Visualization**: Presents the documentation through Swagger UI

### Usage

To document an API endpoint, send your request through the EasyDocs proxy:

```
Original API: https://api.example.com/users
EasyDocs Proxy: http://localhost:3000/api/autodoc?endpoint=https://api.example.com/users
```

The documentation will be automatically generated and available in the Swagger UI at the root path (`/`).

## Roadmap

- [ ] Enhanced AI Processing
  - Improve prompt by applying prompt engineering techniques
  - Reduce OpenApi parameters to the essentials
- [ ] Enabled edition in UI
  - ¿Create our own UI for the API documentation?
  - How to handle conflicts between manually updated and AI-generated documentation?
- [ ] Remove the pagination approach
  - Pagination should be applied in the client

## Contributing

Contributions are welcome! Please feel free to submit a Pull Request.

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/AmazingFeature`)
3. Commit your changes (`git commit -m 'Add some AmazingFeature'`)
4. Push to the branch (`git push origin feature/AmazingFeature`)
5. Open a Pull Request

## Technical Stack

- Next.js 15
- OpenAI GPT-4-turbo
- PostgreSQL with Drizzle ORM
- Swagger UI
- TypeScript
- Tailwind CSS

## License

This project is licensed under the MIT License - see the [LICENSE](LICENSE) file for details.

## Contact

[@iamrubenglez](https://x.com/iamrubenglez)
