import zipfile

from scripts.package_release import ROOT_FILES, SOURCE_DIRECTORIES, build_release


def test_release_excludes_saved_browser_profiles_from_configurable_data_directories(tmp_path):
    for filename in ROOT_FILES:
        (tmp_path / filename).write_text("Public source file\n", encoding="utf-8")
    for dirname in SOURCE_DIRECTORIES:
        (tmp_path / dirname).mkdir()
    (tmp_path / "backend" / "public.py").write_text("PUBLIC = True\n", encoding="utf-8")

    synthetic_values = []
    # DATA_DIR may be configured beneath a source directory instead of the default data/.
    for dirname in ("", *SOURCE_DIRECTORIES):
        for platform in ("allticket", "ttm"):
            profile = tmp_path / dirname / ".ticketpilot-browser-profiles" / platform
            profile.mkdir(parents=True)
            value = f"synthetic-private-session-{dirname or 'root'}-{platform}"
            synthetic_values.append(value.encode())
            (profile / "session.json").write_text(
                f'{{"cookie": "{value}", "localStorage": "{value}"}}\n', encoding="utf-8"
            )

    release = build_release(tmp_path)

    with zipfile.ZipFile(release["archive"]) as archive:
        assert any(name.endswith("/backend/public.py") for name in archive.namelist())
        assert all(".ticketpilot-browser-profiles" not in name for name in archive.namelist())
        for name in archive.namelist():
            content = archive.read(name)
            assert all(value not in content for value in synthetic_values)
