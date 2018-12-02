const huskyConfig = {
    "hooks": {
        "pre-commit": "pushd _bin && ./pre-commit.sh && popd",
        "pre-push": "pushd _bin && ./pre-push.sh && popd"
    }
};

module.exports = huskyConfig;