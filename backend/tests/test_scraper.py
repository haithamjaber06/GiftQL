from app.scraper import normalize


def test_adds_https():
    assert normalize("example.com/thing") == "https://example.com/thing"


def test_lowercases_host_and_drops_www():
    assert normalize("https://WWW.Example.COM/Thing") == "https://example.com/Thing"


def test_strips_trailing_slash():
    assert normalize("https://example.com/thing/") == "https://example.com/thing"


def test_drops_tracking_params_keeps_real_ones():
    url = "https://example.com/p?utm_source=ig&fbclid=xyz&variant=blue"
    assert normalize(url) == "https://example.com/p?variant=blue"


def test_drops_the_fragment():
    assert normalize("https://example.com/p#reviews") == "https://example.com/p"


def test_forces_https():
    assert normalize("http://example.com/p") == "https://example.com/p"


def test_same_link_two_ways_normalises_the_same():
    a = normalize("http://www.example.com/p/?utm_campaign=spring")
    b = normalize("https://example.com/p")
    assert a == b
