# Cooperative Gig Services — Mobile Interface Plan

## Product Direction

Cooperative Gig Services is a portrait-first marketplace that connects residents with vetted local cooperative workers. The interface prioritizes one-handed use: important actions sit in the lower half of each screen, standard 44-point touch targets are maintained, and status-changing operations use clear confirmation feedback. The visual language should feel native on iOS and familiar on Android: generous whitespace, rounded 16–24 point cards, a restrained elevation system, and concise, action-oriented labels.

## Screen List and Primary Functionality

| Screen | Primary content | Key actions |
|---|---|---|
| Splash | Logo, product name, concise local-services tagline, loading state | Route to authentication or saved session |
| Login | Email and password fields, password recovery link | Sign in, open registration, initiate password reset |
| Register and role selection | Name, contact details, password, customer/worker role cards | Create account, choose role |
| Customer home | Greeting, location chip, search, service categories, nearby workers, recent bookings | Search, choose service, open worker or booking detail |
| Services | Search field, service category filters, service list | Filter and select a service |
| Nearby workers | Filter controls and worker cards with distance, availability, rating, experience, and starting price | Open a worker profile |
| Worker profile | Identity, verified state, skills, rating, reviews, service area, availability, and biography | Start booking; message/call only with a valid booking |
| Booking form | Service, date/time, address/map, description, optional photo, estimate | Confirm booking |
| Booking confirmation/detail | Reference number, worker, service and status timeline | View booking, message worker, call worker when valid |
| My bookings | Upcoming, active, completed, and cancelled sections | Open/cancel eligible booking, rate completed service |
| Chat | Recipient identity/status, chronological messages, timestamps, read state, input composer | Send messages for accepted/active bookings only |
| Worker dashboard | Online toggle, earnings summary, request count, job-state summaries | Open requests, jobs, earnings, or profile |
| Job requests | Customer, service, schedule, address and brief | Accept or reject request |
| Active job | Job facts, customer information, status tracker | Message/call, start and complete job |
| Earnings | Today, week, month, completed jobs, history | Review earning periods and job records |
| Worker profile editor | Personal information, photo, skills, service area, availability | Update profile |
| Rating and review | Five-star selector and optional written review | Submit one review per completed booking |
| Admin overview | Customer/worker totals, booking performance, complaints and reports | Open management lists; verify workers |

## Key User Flows

| User | Flow |
|---|---|
| Customer | Splash → Login/register → Customer home → Select service → Nearby workers → Worker profile → Book service → Confirmation → Chat/call after valid booking → Completed service → Rating |
| Worker | Splash → Login/register → Create worker profile → Worker dashboard → Job request → Accept/reject → Active job → Chat/call → Start → Complete → Earnings updated |
| Admin | Login with admin role → Overview → Workers → Verify/report action → Bookings or complaints → Review platform status |

## Color Choices

| Purpose | Color | Rationale |
|---|---|---|
| Cooperative teal | `#0F766E` | Communicates trust, local connection, and service reliability; used for primary actions and active states. |
| Deep ink | `#102A43` | Provides high-contrast headings and navigation labels. |
| Warm canvas | `#F7F8F6` | Gives screens a calm, community-oriented background instead of stark white. |
| White surface | `#FFFFFF` | Keeps cards and forms clear against the canvas. |
| Signal amber | `#D97706` | Indicates pending requests and attention-needed status. |
| Success green | `#15803D` | Indicates online, accepted, confirmed, and completed states. |
| Service coral | `#C2410C` | Reserved for destructive actions and important warnings. |

## Interaction Principles

The main bottom navigation changes by role. Customers receive Home, Explore, Bookings, and Profile. Workers receive Dashboard, Requests, Jobs, and Profile. Administrative views use a simple management tab structure. Booking status is always represented with both a text label and a color-coded badge, so no state relies on color alone. Message and call entry points remain disabled with explanatory text until the booking reaches a valid accepted or active state.
