import React from "react";
import { ScrollView, StatusBar, Platform } from "react-native";
import { Notifications } from "expo";
import * as Permissions from "expo-permissions";
import theme from "./theme";
import Constants from "expo-constants";
import * as Linking from "expo-linking";
import * as Feature from "./feature";
import {
  Header,
  Row,
  Container,
  IconButton,
  SubHeader,
  Paragraph,
  RoundedSelectorButton,
  ActionButton,
} from "./ui";
import { NavigationState, NavigationAction } from "react-navigation";
import { NavigationStackProp } from "react-navigation-stack";
import { CBT_ON_BOARDING_SCREEN, LOCK_SCREEN, DEBUG_SCREEN } from "./screens";
import { setSetting, getSettingOrSetDefault } from "./setting/settingstore";
import { hasPincode, clearPincode } from "./lock/lockstore";
import {
  HISTORY_BUTTON_LABEL_KEY,
  HISTORY_BUTTON_LABEL_DEFAULT,
  NOTIFICATIONS_KEY,
  HistoryButtonLabelSetting,
  isHistoryButtonLabelSetting,
} from "./setting";
import i18n from "./i18n";
import { recordScreenCallOnFocus } from "./navigation";
import { FadesIn } from "./animations";

export { HistoryButtonLabelSetting };

// Exportable settings
export async function getHistoryButtonLabel(): Promise<
  HistoryButtonLabelSetting
> {
  const value = await getSettingOrSetDefault(
    HISTORY_BUTTON_LABEL_KEY,
    HISTORY_BUTTON_LABEL_DEFAULT
  );

  if (!isHistoryButtonLabelSetting(value)) {
    console.error(
      `Something went wrong getting ${HISTORY_BUTTON_LABEL_KEY}. Got: "${value}"`
    );
    return HISTORY_BUTTON_LABEL_DEFAULT;
  }

  return value;
}

export async function getNotifications(): Promise<boolean> {
  try {
    const str = await getSettingOrSetDefault(NOTIFICATIONS_KEY, "false");
    return JSON.parse(str);
  } catch (e) {
    return false;
  }
}

export async function setNotifications(
  feature: Feature.Feature,
  enabled: boolean
): Promise<boolean> {
  await Notifications.cancelAllScheduledNotificationsAsync();
  // don't enable without permission
  enabled = enabled && (await registerForLocalNotificationsAsync());
  if (enabled) {
    await Notifications.presentLocalNotificationAsync({
      title: i18n.t("reminder_notification.intro.title"),
      body: i18n.t("reminder_notification.intro.body"),
      android: {
        channelId: "default",
        // icon: "https://freecbt.erosson.org/notifications/quirk-bw.png",
        icon: "https://freecbt.erosson.org/static/favicon/favicon.ico",
        color: "#F78FB3",
      },
    });
    await Notifications.scheduleLocalNotificationAsync(
      {
        title: i18n.t("reminder_notification.1.title"),
        body: i18n.t("reminder_notification.1.body"),
        android: {
          channelId: "default",
          // icon: "https://freecbt.erosson.org/notifications/quirk-bw.png",
          icon: "https://freecbt.erosson.org/static/favicon/favicon.ico",
          color: "#F78FB3",
        },
      },
      feature.remindersEachMinute
        ? { time: Date.now() + 10 * 1000, repeat: "minute" } // ridiculously often, for debugging
        : { time: Date.now() + 86400 * 10000, repeat: "day" } // start one day later
    );
  }
  setSetting(NOTIFICATIONS_KEY, JSON.stringify(enabled));
  return enabled;
}

async function registerForLocalNotificationsAsync() {
  const { status: existingStatus } = await Permissions.getAsync(
    Permissions.NOTIFICATIONS
  );
  let finalStatus = existingStatus;
  if (existingStatus !== "granted") {
    const { status } = await Permissions.askAsync(Permissions.NOTIFICATIONS);
    finalStatus = status;
  }
  if (finalStatus !== "granted") {
    return false;
  }

  if (Platform.OS === "android") {
    await Notifications.createChannelAndroidAsync("default", {
      name: "default",
      sound: true,
      priority: "max",
      vibrate: [0, 250, 250, 250],
    });
  }
  return true;
}

interface Props {
  navigation: NavigationStackProp<NavigationState, NavigationAction>;
}

interface State {
  isReady: boolean;
  historyButtonLabel?: HistoryButtonLabelSetting;
  areNotificationsOn: boolean;
  hasPincode: boolean;
  // click the invisible button at the bottom 5 times to go to the secret debug screen
  debugClicks: number;
}

class SettingScreen extends React.Component<Props, State> {
  static navigationOptions = {
    header: null,
  };

  constructor(props) {
    super(props);
    this.state = {
      isReady: false,
      areNotificationsOn: false,
      hasPincode: false,
      debugClicks: 0,
    };
    recordScreenCallOnFocus(this.props.navigation, "settings");
  }

  async componentDidMount() {
    await this.refresh();
  }

  refresh = async () => {
    const [h, n, p] = await Promise.all([
      getHistoryButtonLabel(),
      getNotifications(),
      hasPincode(),
    ]);
    this.setState({
      historyButtonLabel: h,
      areNotificationsOn: n,
      hasPincode: p,
      isReady: true,
    });
  };

  navigateToList = () => {
    this.props.navigation.pop();
  };

  navigateToOnboardingScreen = () => {
    this.props.navigation.navigate(CBT_ON_BOARDING_SCREEN);
  };

  toggleHistoryButtonLabels = () => {
    if (!this.state.isReady) {
      this.refresh();
      return;
    }

    if (this.state.historyButtonLabel === "alternative-thought") {
      setSetting<HistoryButtonLabelSetting>(
        HISTORY_BUTTON_LABEL_KEY,
        "automatic-thought"
      );
      this.refresh();
    } else {
      setSetting<HistoryButtonLabelSetting>(
        HISTORY_BUTTON_LABEL_KEY,
        "alternative-thought"
      );
      this.refresh();
    }
  };

  render() {
    const { historyButtonLabel, isReady } = this.state;

    return (
      <Feature.Context.Consumer>
        {({ feature }) => (
          <FadesIn
            style={{ backgroundColor: theme.lightOffwhite }}
            pose={isReady ? "visible" : "hidden"}
          >
            <ScrollView
              style={{
                backgroundColor: theme.lightOffwhite,
                marginTop: Constants.statusBarHeight,
                paddingTop: 24,
                height: "100%",
              }}
            >
              <Container
                style={{
                  paddingBottom: 128,
                }}
              >
                <StatusBar barStyle="dark-content" />
                <Row style={{ marginBottom: 18 }}>
                  <Header>{i18n.t("settings.header")}</Header>
                  <IconButton
                    featherIconName={"list"}
                    accessibilityLabel={i18n.t("accessibility.list_button")}
                    onPress={() => this.navigateToList()}
                  />
                </Row>

                {feature.reminders && (
                  <Row
                    style={{
                      marginBottom: 18,
                      display: "flex",
                      flexDirection: "column",
                    }}
                  >
                    <SubHeader>*reminders</SubHeader>
                    <Paragraph
                      style={{
                        marginBottom: 9,
                      }}
                    >
                      If you'd like, you can turn on notification reminders that
                      help you build up the habit of challenging thoughts.
                    </Paragraph>
                    <RoundedSelectorButton
                      title={"Please remind me"}
                      selected={this.state.areNotificationsOn}
                      onPress={async () => {
                        await setNotifications(feature, true);
                        this.refresh();
                      }}
                    />

                    <RoundedSelectorButton
                      title={"No reminders, thanks"}
                      selected={!this.state.areNotificationsOn}
                      onPress={async () => {
                        await setNotifications(feature, false);
                        this.refresh();
                      }}
                    />
                  </Row>
                )}
                <Row
                  style={{
                    marginBottom: 18,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <SubHeader>*pincode lock 🔒</SubHeader>
                  <Paragraph
                    style={{
                      marginBottom: 9,
                    }}
                  >
                    You can lock the app with a pincode if you'd like. Be warned
                    that the only way to reset a forgotten code is to erase all
                    your data, so be careful not to forget.
                  </Paragraph>
                  {this.state.hasPincode ? (
                    <>
                      <ActionButton
                        flex={1}
                        title={"Update Pincode"}
                        width={"100%"}
                        fillColor="#EDF0FC"
                        textColor={theme.darkBlue}
                        onPress={() => {
                          this.props.navigation.push(LOCK_SCREEN, {
                            isSettingCode: true,
                          });
                        }}
                      />
                      <ActionButton
                        flex={1}
                        title={"Clear Pincode"}
                        width={"100%"}
                        fillColor="#EDF0FC"
                        textColor={theme.darkBlue}
                        onPress={async () => {
                          await clearPincode();
                          this.refresh();
                        }}
                      />
                    </>
                  ) : (
                    <ActionButton
                      flex={1}
                      title={"Set Pincode"}
                      width={"100%"}
                      fillColor="#EDF0FC"
                      textColor={theme.darkBlue}
                      onPress={() => {
                        this.props.navigation.push(LOCK_SCREEN, {
                          isSettingCode: true,
                        });
                      }}
                    />
                  )}
                </Row>

                <Row
                  style={{
                    marginBottom: 18,
                    display: "flex",
                    flexDirection: "column",
                  }}
                >
                  <SubHeader>*history button labels</SubHeader>
                  <Paragraph
                    style={{
                      marginBottom: 9,
                    }}
                  >
                    By default, we set the buttons in the history screen to use
                    the Alternative Thought. This helps cement the thought as
                    "changed."
                  </Paragraph>
                  <RoundedSelectorButton
                    title={"Alternative Thought"}
                    selected={historyButtonLabel === "alternative-thought"}
                    onPress={() => this.toggleHistoryButtonLabels()}
                  />
                  <RoundedSelectorButton
                    title={"Automatic Thought"}
                    selected={historyButtonLabel === "automatic-thought"}
                    onPress={() => this.toggleHistoryButtonLabels()}
                  />
                </Row>

                <Row
                  style={{
                    marginBottom: 9,
                  }}
                >
                  <ActionButton
                    flex={1}
                    title={"Privacy Policy"}
                    fillColor="#EDF0FC"
                    textColor={theme.darkBlue}
                    onPress={() => {
                      const url =
                        "https://github.com/erosson/freecbt/blob/master/PRIVACY.md";
                      Linking.canOpenURL(url).then(() => Linking.openURL(url));
                    }}
                  />
                </Row>
                <Row>
                  <ActionButton
                    flex={1}
                    title={"Terms of Service"}
                    fillColor="#EDF0FC"
                    textColor={theme.darkBlue}
                    onPress={() => {
                      const url =
                        "https://github.com/erosson/freecbt/blob/master/TOS.md";
                      Linking.canOpenURL(url).then(() => Linking.openURL(url));
                    }}
                  />
                </Row>
                <Row>
                  <ActionButton
                    flex={1}
                    opacity={feature.debugVisible ? 1 : 0}
                    fillColor={feature.debugVisible ? null : "#ffffff"}
                    textColor={feature.debugVisible ? null : "#ffffff"}
                    title={"Debug"}
                    onPress={() => {
                      const debugClicks = this.state.debugClicks + 1;
                      this.setState({ debugClicks });
                      if (debugClicks >= 5) {
                        this.setState({ debugClicks: 0 });
                        this.props.navigation.navigate(DEBUG_SCREEN);
                      }
                    }}
                  />
                </Row>
              </Container>
            </ScrollView>
          </FadesIn>
        )}
      </Feature.Context.Consumer>
    );
  }
}

export default SettingScreen;
