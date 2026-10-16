#!/bin/sh
# Capacitor 8 的安卓工程需要 JDK 21；本机默认 Java 不是 21 时，自动改用 Homebrew 的 openjdk@21
if ! java -version 2>&1 | grep -q '"21'; then
  for h in /opt/homebrew/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home /usr/local/opt/openjdk@21/libexec/openjdk.jdk/Contents/Home; do
    [ -d "$h" ] && export JAVA_HOME="$h" && break
  done
fi
cd "$(dirname "$0")/../android" && exec ./gradlew "$@"
