import pandas as pd
import matplotlib.pyplot as plt

# =========================
# Experiment results
# =========================

data = {
    "Method": ["LLM Only", "Local RAG Only", "Local RAG + STCF"],
    "FR": [0.172, 0.000, 0.033],
    "RR": [0.036, 0.069, 0.097],
    "AR": [0.009, 0.098, 0.000],
    "STR": [0.654, 0.950, 0.788],
    "PR": [0.726, 0.835, 0.851],
    "Avg POIs": [6.833, 6.033, 4.300],
    "Avg Stops/Day": [5.372, 4.672, 3.750],
    "Avg Candidates": [0.000, 12.000, 4.400],
    "Avg Retrieved": [0.000, 12.000, 12.000],
}

df = pd.DataFrame(data)

# =========================
# Figure 1: Main metrics
# =========================

metrics = ["FR", "RR", "AR", "STR", "PR"]

ax = df.set_index("Method")[metrics].plot(
    kind="bar",
    figsize=(10, 5),
    rot=0
)

plt.title("Comparison of Route Generation Methods on Main Metrics")
plt.ylabel("Score")
plt.xlabel("Method")
plt.ylim(0, 1.05)
plt.legend(title="Metrics")
plt.tight_layout()
plt.savefig("main_metrics_comparison.png", dpi=300)
plt.show()

# =========================
# Figure 2: Lower-is-better metrics
# =========================

lower_metrics = ["FR", "RR", "AR"]

ax = df.set_index("Method")[lower_metrics].plot(
    kind="bar",
    figsize=(9, 5),
    rot=0
)

plt.title("Comparison of Lower-is-Better Metrics")
plt.ylabel("Rate")
plt.xlabel("Method")
plt.ylim(0, 0.2)
plt.legend(title="Metrics")
plt.tight_layout()
plt.savefig("lower_metrics_comparison.png", dpi=300)
plt.show()

# =========================
# Figure 3: Higher-is-better metrics
# =========================

higher_metrics = ["STR", "PR"]

ax = df.set_index("Method")[higher_metrics].plot(
    kind="bar",
    figsize=(8, 5),
    rot=0
)

plt.title("Comparison of Higher-is-Better Metrics")
plt.ylabel("Score")
plt.xlabel("Method")
plt.ylim(0, 1.05)
plt.legend(title="Metrics")
plt.tight_layout()
plt.savefig("higher_metrics_comparison.png", dpi=300)
plt.show()

# =========================
# Figure 4: Average POIs and candidate numbers
# =========================

count_metrics = ["Avg POIs", "Avg Stops/Day", "Avg Candidates", "Avg Retrieved"]

ax = df.set_index("Method")[count_metrics].plot(
    kind="bar",
    figsize=(10, 5),
    rot=0
)

plt.title("Comparison of Route Length and Candidate Size")
plt.ylabel("Average Count")
plt.xlabel("Method")
plt.legend(title="Count Metrics")
plt.tight_layout()
plt.savefig("count_metrics_comparison.png", dpi=300)
plt.show()