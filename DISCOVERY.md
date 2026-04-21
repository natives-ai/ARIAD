# DISCOVERY.md

## 0. Meta
- Product: **SCENAAIRO**
- Stage: **Discovery baseline locked**
- Primary format: **Webtoon**
- Primary user: **Solo creator currently serializing on a recurring schedule**
- Default product language: **English**
- Planned future localizations: **Korean, Japanese**

## 1. One-line summary
SCENAAIRO is an AI-assisted storytelling support product for solo serial webtoon creators who need to reach a usable structure draft for the current episode faster without losing creative ownership.

## 2. Core problem
### 2.1 Primary problem
Creators working under short serialization cycles, especially weekly cycles, often know the broad direction of the story but get stuck when they must decide how the current episode should actually unfold.

That bottleneck does not remain inside writing. It propagates into:
- delayed storyboard work
- reduced drawing time
- lower visual and narrative quality
- higher skip/hiatus risk

### 2.2 Most painful bottleneck
The most important bottleneck is not “writing everything from scratch,” but **locking the episode structure early enough**.

In practice, creators often already know:
- the world
- the main characters
- rough arc direction
- the start point or end point for the episode

What remains unresolved is:
- how to bridge the episode internally
- how to arrange beats and scenes
- how to pace emotional movement
- how to connect the current episode cleanly to the next one

## 3. Why the problem matters
In weekly-style production, story delay becomes total production delay.

If the structure draft is late:
- storyboarding is late
- drawing starts later
- drawing quality or panel composition suffers
- hiatus risk rises
- long-term audience trust, ratings, and continuation stability can degrade

The first user-visible value is not “higher views.”
It is **saving enough time to stabilize the next episode’s production process**.

## 4. Target user
### 4.1 Primary target
The initial target user is:
- a **solo webtoon creator**
- already **serializing on a recurring schedule**
- often in a relatively under-supported environment
- more likely to be early-career, lower-profile, or less resource-supported than top-tier platform creators

### 4.2 Why this user first
This user:
- feels the structure bottleneck directly
- has less editorial or internal support
- is more likely to try an AI support tool
- experiences immediate production pain when the episode structure is not settled quickly

### 4.3 Excluded from the first focus
The first product focus is **not**:
- broad new-series ideation before publication
- large studio pipelines
- top-tier creators with strong internal support systems
- a generic storytelling platform for every format at once

## 5. Representative user situation
### 5.1 Baseline scenario
A solo webtoon creator uploads this week’s episode and must immediately begin the next one.
They already know the broad episode requirement, but cannot settle the internal unfolding quickly enough.

### 5.2 Example of the bottleneck
The creator may know:
- the episode begins with a meeting at a café
- the episode must end with the heroine’s mother telling the male lead to leave her daughter

But they do not yet know:
- what happens between those points
- how the scenes should be ordered
- how the emotional pressure should build
- what exact interactions will make the bridge feel coherent

### 5.3 Time-pressure assumption
For a weekly cycle, if the structure draft is still not settled by roughly day 4, hiatus or quality collapse risk rises sharply, because drawing still requires several days.

## 6. Jobs to be done
### Functional jobs
The user wants to:
- explore plausible next-beat candidates quickly
- compare and modify candidate directions
- turn them into a usable structure draft for the current episode
- move into storyboard and drawing sooner

### Emotional jobs
The user wants to:
- reduce decision fatigue
- avoid the feeling of being creatively replaced
- preserve the feeling that the work is still fully theirs

### Social/identity job
Even when using AI assistance, the creator does not want the final work to feel machine-authored or detached from their own authorship.

## 7. Current alternatives and limits
### 7.1 Solo note-taking / self-brainstorming
Useful but slow. If the creator gets stuck, they can stay stuck for too long.

### 7.2 Editor or peer feedback
Helpful, but can drift into loss of creative ownership or too many voices. Editors are not always available as active co-ideators.

### 7.3 Prewritten plot/setting documents
Useful at the macro level, but often too coarse for current-episode structure work.

### 7.4 General-purpose AI chat tools
Can help with ideation, but are not structurally optimized for comparing, editing, selecting, and assembling episode-level structure candidates.

## 8. Core value hypothesis
The initial core value is:
- **helping the creator reduce the time required to lock the current episode structure draft**

That value is delivered by:
- presenting editable candidate directions
- letting the creator modify and choose among them
- preserving control over final decisions

The product is not valuable because it generates text.
It is valuable because it **reduces the structure bottleneck without taking over authorship**.

## 9. Non-negotiable principles
### 9.1 Creative ownership remains with the creator
The creator must make the final selection.
AI may suggest and support, but must not silently decide.

### 9.2 Foundational settings must not be casually violated
The product should not casually overturn:
- the world
- the core character identity
- previously established foundational settings

### 9.3 Macro-arc intervention is limited
The initial product is episode-first.
Arc-level help can exist only as a limited, user-invoked exception.

## 10. Initial input baseline
The minimum meaningful input bundle is:
1. world setting
2. character setting
3. current story progress plus the endpoint or required event for the current episode

More information can improve suggestion quality, but the product should still be designed around helping creators work from incomplete structure.

## 11. Goals
- Help creators reach a usable current-episode structure draft faster
- Reduce episode-level ideation bottlenecks
- Preserve world/character consistency as much as possible
- Return time to storyboard and drawing work
- Keep AI assistance compatible with creative ownership

## 12. Non-goals
- fully auto-writing the story
- redefining the world, theme, or core character identity
- beginning as a broad new-series planning product
- handling every story format at launch
- turning the first version into a full visual story-management platform

## 13. Early success signals
The earliest meaningful signals are:
- users feel current-episode structure drafting becomes noticeably faster
- users return immediately after publishing one episode to work on the next
- users repeatedly modify and select from suggestions instead of abandoning the flow

Longer-term signals may include fewer production collapses, better quality stability, and stronger audience response, but those are not the first validation target.

## 14. Failure signals
- suggestion volume increases but structure-lock time does not decrease
- users feel the system does not understand their work
- users still have to restart from scratch after seeing suggestions
- the AI repeatedly violates world/character consistency
- the workflow feels no better than a generic chat tool
- curiosity use exists, but repeat use does not

## 15. Major assumptions
- solo serial webtoon creators frequently experience episode-structure bottlenecks
- lower-resource creators are more likely to adopt this kind of support tool early
- creators prefer editable candidates over auto-finalized story decisions
- with enough context, AI can produce useful candidate directions without constantly violating core setup
- users will value time savings and production stability before broader downstream metrics like views

## 16. Known constraints
- initial format focus is webtoon
- initial user focus is solo creators
- the key usage moment is immediately after episode upload
- the creator must remain in control of final structure decisions
- the first version should stay episode-centered
- macro-arc help must be limited and user-invoked

## 17. Open questions for later phases
- How strongly do real target creators describe this as their top bottleneck?
- How narrow should the first user segment become inside “solo serial webtoon creators”?
- What level of AI intervention still feels acceptable to creators?
- What input format gives the best tradeoff between quality and user effort?
- What pricing threshold maps to meaningful time savings?
- Should editors or collaborators later become secondary users?

## 18. Major risks
- the external observation of the problem may not perfectly match creator self-perception
- AI may feel either too weak to matter or too invasive to trust
- structurally useful suggestions may still fail to feel like “my work” to the user
- repeat value may be weaker than initial curiosity if workflow differentiation is not strong enough

## 19. Discovery completion note
Discovery is considered strong enough to drive:
- specification work
- scaffold planning
- agent-system design
- implementation planning

Remaining questions are implementation-shaping or validation-shaping questions, not fundamental problem-framing gaps.
