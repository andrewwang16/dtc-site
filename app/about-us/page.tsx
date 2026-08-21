"use client";

import { useState } from "react";

type PersonCard = {
  name: string;
  title: string;
  image: string;
  bio: string;
};

const people: PersonCard[] = [
  {
    name: "Josh Jacobs",
    title: "Founding Member",
    image: "/images/josh_jacobs.jpg",
    bio: "Bio coming soon.",
  },
  {
    name: "Sandy McMillan",
    title: "Founding Member",
    image: "/images/sandy_mcmillan.jpg",
    bio: "Bio coming soon.",
  },
  {
    name: "Andrew Wang",
    title: "Founding Member",
    image: "/images/andrew_wang.jpg",
    bio: "Bio coming soon.",
  },
  {
    name: "Kareem Haq",
    title: "Birds on the Farm Host",
    image: "/images/kareem_haq.jpg",
    bio: "Bio coming soon.",
  },
  {
    name: "Tyler Gettinger",
    title: "Contributor",
    image: "/images/tyler_gettinger.jpg",
    bio: "Bio coming soon.",
  },
  {
    name: "Aidan Gray",
    title: "Contributor",
    image: "/images/aidan_gray.jpg",
    bio: "Bio coming soon.",
  },
];

function PersonCard({
  person,
  onSelect,
}: {
  person: PersonCard;
  onSelect: (person: PersonCard) => void;
}) {
  return (
    <article
      role="button"
      tabIndex={0}
      onClick={() => onSelect(person)}
      onKeyDown={(e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          onSelect(person);
        }
      }}
      style={{
        border: "1px solid var(--line)",
        borderRadius: "18px",
        background: "var(--panel)",
        padding: "1rem",
        overflow: "hidden",
        cursor: "pointer",
        textAlign: "left",
      }}
    >
      <div
        style={{
          width: "100%",
          aspectRatio: "1 / 1",
          overflow: "hidden",
          borderRadius: "14px",
          background: "#12070b",
        }}
      >
        <img
          src={person.image}
          alt={person.name}
          style={{
            width: "100%",
            height: "100%",
            display: "block",
            objectFit: "cover",
          }}
        />
      </div>

      <p
        className="kicker"
        style={{
          marginTop: "0.9rem",
          marginBottom: "0.35rem",
        }}
      >
        {person.title}
      </p>

      <h3 style={{ margin: 0 }}>{person.name}</h3>
    </article>
  );
}

function PersonModal({
  person,
  onClose,
}: {
  person: PersonCard;
  onClose: () => void;
}) {
  return (
    <div
      onClick={onClose}
      style={{
        position: "fixed",
        inset: 0,
        background: "rgba(10, 4, 6, 0.75)",
        display: "flex",
        alignItems: "center",
        justifyContent: "center",
        padding: "1.5rem",
        zIndex: 100,
      }}
    >
      <div
        onClick={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label={person.name}
        style={{
          width: "100%",
          maxWidth: "560px",
          maxHeight: "90vh",
          overflowY: "auto",
          border: "1px solid var(--line)",
          borderRadius: "18px",
          background: "var(--panel)",
          padding: "1.5rem",
          position: "relative",
        }}
      >
        <button
          onClick={onClose}
          aria-label="Close"
          style={{
            position: "absolute",
            top: "1rem",
            right: "1rem",
            width: "2rem",
            height: "2rem",
            borderRadius: "999px",
            border: "1px solid var(--line)",
            background: "var(--bg-soft)",
            color: "var(--text)",
            cursor: "pointer",
            fontSize: "1rem",
            lineHeight: 1,
          }}
        >
          ×
        </button>

        <div
          style={{
            width: "100%",
            maxWidth: "260px",
            aspectRatio: "1 / 1",
            overflow: "hidden",
            borderRadius: "14px",
            background: "#12070b",
            margin: "0 auto",
          }}
        >
          <img
            src={person.image}
            alt={person.name}
            style={{
              width: "100%",
              height: "100%",
              display: "block",
              objectFit: "cover",
            }}
          />
        </div>

        <p
          className="kicker"
          style={{
            marginTop: "1.2rem",
            marginBottom: "0.35rem",
            textAlign: "center",
          }}
        >
          {person.title}
        </p>

        <h3 style={{ margin: 0, textAlign: "center" }}>{person.name}</h3>

        <p
          style={{
            marginTop: "1rem",
            color: "var(--muted)",
            fontSize: "1rem",
            lineHeight: 1.7,
          }}
        >
          {person.bio}
        </p>
      </div>
    </div>
  );
}

export default function AboutUsPage() {
  const [selected, setSelected] = useState<PersonCard | null>(null);

  return (
    <div
      style={{
        display: "grid",
        gap: "3rem",
        paddingTop: "2.2rem",
        paddingBottom: "4rem",
      }}
    >
      <section className="container fade-up">
        <p className="kicker" style={{ marginBottom: "0.5rem" }}>
          DEALIN&apos; THE CARDS
        </p>

        <h1 className="section-title">Meet the Team</h1>

        <p
          style={{
            marginTop: "0.9rem",
            color: "var(--muted)",
            maxWidth: "68ch",
            fontSize: "1.05rem",
            lineHeight: 1.7,
          }}
        >
          Dealin&apos; the Cards is a Cardinals media brand centered on
          thoughtful baseball conversation, recurring shows, and a fan-first
          point of view.
        </p>
      </section>

      <section
        className="container fade-up"
        style={{ animationDelay: "0.1s" }}
      >
        <div
          style={{
            display: "grid",
            gap: "0.5rem",
            gridTemplateColumns:
              "repeat(auto-fit, minmax(220px, 1fr))",
          }}
        >
          {people.map((person) => (
            <PersonCard
              key={person.name}
              person={person}
              onSelect={setSelected}
            />
          ))}
        </div>
      </section>

      {selected && (
        <PersonModal person={selected} onClose={() => setSelected(null)} />
      )}
    </div>
  );
}
