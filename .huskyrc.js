const huskyConfig = {
    "hooks": {
        "pre-commit": "./_bin/pre-commit.sh",
        "pre-push": "./_bin/pre-push.sh"
    }
};

module.exports = huskyConfig;