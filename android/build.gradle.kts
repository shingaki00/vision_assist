allprojects {
    repositories {
        google()
        mavenCentral()
    }
}

val newBuildDir: Directory =
    rootProject.layout.buildDirectory
        .dir("../../build")
        .get()
rootProject.layout.buildDirectory.value(newBuildDir)

subprojects {
    val newSubprojectBuildDir: Directory = newBuildDir.dir(project.name)
    project.layout.buildDirectory.value(newSubprojectBuildDir)
}
subprojects {
    project.evaluationDependsOn(":app")
}

// プラグインのみを対象に compileSdk を 36 へ安全に適用
subprojects {
    if (project.name != "app") {
        val configureAndroid: () -> Unit = {
            extensions.findByName("android")?.let { android ->
                try {
                    val method = android.javaClass.getMethod("compileSdkVersion", Int::class.javaPrimitiveType)
                    method.invoke(android, 36)
                } catch (_: Exception) {
                    try {
                        val method = android.javaClass.getMethod("setCompileSdk", Int::class.javaPrimitiveType)
                        method.invoke(android, 36)
                    } catch (_: Exception) {}
                }
            }
        }
        if (state.executed) {
            configureAndroid()
        } else {
            afterEvaluate { configureAndroid() }
        }
    }
}

tasks.register<Delete>("clean") {
    delete(rootProject.layout.buildDirectory)
}
