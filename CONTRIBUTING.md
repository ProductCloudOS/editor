# Contributing to PC Editor

Thank you for your interest in contributing to PC Editor! This document provides guidelines and information for contributors.

## Code of Conduct

By participating in this project, you agree to maintain a respectful and inclusive environment for everyone.

## Getting Started

### Prerequisites

- Node.js 18.0.0 or higher
- npm 9.0.0 or higher

### Development Setup

1. Fork the repository on GitHub
2. Clone your fork locally:
   ```bash
   git clone https://github.com/YOUR_USERNAME/pc-editor.git
   cd pc-editor
   ```
3. Install dependencies:
   ```bash
   npm install
   ```
4. Start the development server:
   ```bash
   npm run dev
   ```
5. Open http://localhost:5173 to see the demo application

## Development Workflow

### Branch Naming

- `feature/description` - New features
- `fix/description` - Bug fixes
- `docs/description` - Documentation changes
- `refactor/description` - Code refactoring
- `test/description` - Test additions or fixes

### Making Changes

1. Create a new branch from `main`:
   ```bash
   git checkout -b feature/your-feature-name
   ```

2. Make your changes following the coding standards below

3. Run the test suite:
   ```bash
   npm run test:run
   ```

4. Run type checking:
   ```bash
   npm run type-check
   ```

5. Run the linter:
   ```bash
   npm run lint
   ```

6. Build the project to ensure it compiles:
   ```bash
   npm run build
   ```

### Commit Messages

Follow conventional commit format:

- `feat: add new feature`
- `fix: resolve bug in component`
- `docs: update API documentation`
- `refactor: restructure module`
- `test: add unit tests for feature`
- `chore: update dependencies`

### Pull Requests

1. Push your branch to your fork
2. Open a pull request against the `main` branch
3. Fill out the pull request template
4. Wait for CI checks to pass
5. Address any review feedback

## Coding Standards

### TypeScript

- Use strict TypeScript - avoid `any` types
- Export types that consumers might need
- Use interfaces for object shapes, types for unions/primitives
- Document public APIs with JSDoc comments

### File Organization

```
src/
├── lib/                 # Core library code
│   ├── core/           # Document and content management
│   ├── elements/       # Element implementations
│   ├── rendering/      # Canvas rendering system
│   ├── events/         # Event system
│   ├── objects/        # Embedded objects (tables, images)
│   ├── import/         # PDF import functionality
│   ├── export/         # PDF export functionality
│   └── types/          # TypeScript type definitions
├── demo/               # Demo application
└── test/              # Test files
```

### Naming Conventions

- **Files**: PascalCase for classes (`PCEditor.ts`), camelCase for utilities (`utils.ts`)
- **Classes**: PascalCase (`FlowingTextContent`)
- **Interfaces/Types**: PascalCase with descriptive names (`TextFormattingStyle`)
- **Functions/Methods**: camelCase (`getFlowingText`)
- **Constants**: UPPER_SNAKE_CASE for true constants, camelCase for configuration objects
- **Private members**: Prefix with underscore (`_internalState`)

### Code Style

- Use ES6+ features
- Prefer `const` over `let`, avoid `var`
- Use arrow functions for callbacks
- Use async/await over raw promises
- Keep functions focused and small
- Add meaningful comments for complex logic

### Testing

- Write tests for new features
- Maintain existing test coverage
- Use descriptive test names
- Test edge cases and error conditions

```typescript
describe('FeatureName', () => {
  it('should handle specific scenario', () => {
    // Arrange
    const input = createTestInput();

    // Act
    const result = featureUnderTest(input);

    // Assert
    expect(result).toEqual(expectedOutput);
  });
});
```

## Architecture Guidelines

### Event-Driven Design

PC Editor uses an event-driven architecture. When adding new features:

- Emit events for state changes that other components might need
- Subscribe to events rather than creating tight coupling
- Use the existing `EventEmitter` pattern

### Canvas Rendering

- Batch rendering operations when possible
- Avoid unnecessary redraws
- Use the existing render cycle rather than direct canvas manipulation

### Document Model

When modifying document structure:

- Update serialization (`toData()`) and deserialization (`fromData()`)
- Update PDF export in `PDFGenerator.ts`
- Ensure undo/redo compatibility
- Test multi-page scenarios

## Reporting Issues

### Bug Reports

Include:
- Clear description of the problem
- Steps to reproduce
- Expected vs actual behavior
- Browser and OS information
- Screenshots if applicable

### Feature Requests

Include:
- Clear description of the feature
- Use case / motivation
- Proposed API (if applicable)
- Willingness to contribute

## Getting Help

- Open an issue for questions
- Check existing issues and discussions
- Review the documentation

## License

By contributing, you agree that your contributions will be licensed under the MIT License.
