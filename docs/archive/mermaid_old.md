# MessageAI Architecture Diagrams

## System Overview

```mermaid
flowchart TD
    A[Mobile App - Expo] -->|Auth| B[Firebase Auth]
    A -->|Realtime| C[Firestore]
    A -->|Storage| D[Firebase Storage]
    A -->|Push tokens| E[FCM]
    A -->|AI actions| F[Cloud Functions]
    F -->|LLM calls| G[(OpenAI/Claude)]
    C -->|Triggers on message create| F
```

## Message Flow

```mermaid
sequenceDiagram
    participant U as User A (client)
    participant F as Firestore
    participant CF as Cloud Function
    participant L as LLM
    Note over U: Send message (optimistic)
    U->>U: Add local message {status: sending}
    U->>F: write message {senderId, text}
    F-->>U: snapshot ack (status: sent)
    F-->>OtherClients: realtime update
    F-->>CF: onCreate(messages)
    CF->>L: classify priority / extract decisions
    L-->>CF: results
    CF->>F: update message.priority / write decisions
```

## AI Summarization Flow

```mermaid
sequenceDiagram
    participant C as Chat Screen
    participant F as Firestore
    participant CF as Cloud Function
    participant L as LLM
    C->>F: fetch last N messages
    C->>CF: request summarize(threadId, range)
    CF->>F: read conversation slice
    CF->>L: prompt(messages)
    L-->>CF: summary + action items + decisions
    CF->>F: cache summary doc
    CF-->>C: return summaryId
    C->>F: subscribe to summaries/{summaryId}
```

## Authentication Flow

```mermaid
sequenceDiagram
    participant U as User
    participant A as App
    participant FA as Firebase Auth
    participant FS as Firestore
    U->>A: Enter email/password
    A->>FA: signInWithEmailAndPassword()
    FA-->>A: User credential
    A->>FS: Update user/{uid}.lastSeen
    A->>A: Store user in global state
    A-->>U: Navigate to Threads screen
```

## Offline Message Queue

```mermaid
sequenceDiagram
    participant U as User
    participant A as App (offline)
    participant Q as Local Queue
    participant F as Firestore
    U->>A: Send message
    A->>Q: Queue message {text, threadId, tempId}
    A-->>U: Show as "sending"
    Note over A: Network reconnects
    Q->>F: Flush queued messages
    F-->>A: Confirm writes
    A-->>U: Update status to "sent"
```

## Data Model

```mermaid
erDiagram
    USERS ||--o{ THREADS : "member of"
    THREADS ||--|{ MESSAGES : contains
    THREADS ||--|{ MEMBERS : has
    THREADS ||--o{ SUMMARIES : has
    THREADS ||--o{ DECISIONS : has
    MESSAGES ||--o| EMBEDDINGS : generates
    
    USERS {
        string uid PK
        string email
        string displayName
        string photoURL
        timestamp lastSeen
        string pushToken
    }
    
    THREADS {
        string id PK
        string type
        array members
        timestamp createdAt
        timestamp updatedAt
        object lastMessage
    }
    
    MESSAGES {
        string id PK
        string senderId FK
        string text
        object media
        string status
        string priority
        timestamp createdAt
    }
    
    MEMBERS {
        string uid PK
        timestamp readAt
        boolean typing
        string role
    }
    
    SUMMARIES {
        string id PK
        string text
        array actionItems
        array decisions
        object range
        timestamp createdAt
    }
    
    DECISIONS {
        string id PK
        string summary
        string owner
        string messageId FK
        timestamp decidedAt
    }
```

## Component Hierarchy

```mermaid
graph TD
    A[App.tsx] --> B[NavigationContainer]
    B --> C{Auth State}
    C -->|Not Logged In| D[LoginScreen]
    C -->|Logged In| E[ThreadsScreen]
    C -->|Logged In| F[ChatScreen]
    C -->|Logged In| G[ProfileScreen]
    
    E --> H[ThreadList]
    H --> I[ThreadItem]
    
    F --> J[MessageList]
    F --> K[Composer]
    F --> L[Header]
    J --> M[MessageBubble]
    J --> N[TypingDots]
    
    K --> O[TextInput]
    K --> P[ImagePicker]
    K --> Q[SendButton]
```

## State Management

```mermaid
graph LR
    A[Zustand Store] --> B[User State]
    A --> C[Loading State]
    
    D[useAuth Hook] --> A
    D --> E[Firebase Auth]
    
    F[useThreads Hook] --> G[Firestore Listener]
    G --> H[Threads State]
    
    I[usePresence Hook] --> J[Firestore Updates]
```

## Cloud Functions Architecture

```mermaid
graph TD
    A[Firestore Trigger] -->|onCreate message| B[priority.ts]
    B --> C[OpenAI Classification]
    C --> D[Update message.priority]
    C --> E[Extract & store decisions]
    
    F[HTTP Callable] -->|summarize| G[summary.ts]
    G --> H[Fetch messages]
    H --> I[OpenAI Summarization]
    I --> J[Cache in Firestore]
    
    K[HTTP Callable] -->|extract| L[summary.ts]
    L --> M[Fetch messages]
    M --> N[OpenAI Extraction]
    N --> O[Store action items]
```

## Push Notification Flow

```mermaid
sequenceDiagram
    participant U1 as User A
    participant A1 as App A
    participant FS as Firestore
    participant CF as Cloud Function
    participant FCM as Firebase Messaging
    participant A2 as App B (background)
    participant U2 as User B
    
    U1->>A1: Send message
    A1->>FS: Write message
    FS-->>CF: Trigger onCreate
    CF->>FS: Read thread members
    CF->>FS: Get recipient push tokens
    CF->>FCM: Send notification
    FCM-->>A2: Deliver push
    A2-->>U2: Show notification
    U2->>A2: Tap notification
    A2->>A2: Open thread
```

