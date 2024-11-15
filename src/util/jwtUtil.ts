import axios, { AxiosResponse, InternalAxiosRequestConfig } from "axios";
import { Cookies } from "react-cookie";
import { refreshRequest } from "../apis/adminlogin/adminloginAPI.ts";

const cookies = new Cookies();
const jwtAxios = axios.create();

// 요청 보내기 전에 accessToken을 쿠키에서 꺼내서 헤더에 추가
const beforeReq = (config: InternalAxiosRequestConfig): InternalAxiosRequestConfig => {
    const adminLoginCookie = cookies.get("adminlogin");

    if (!adminLoginCookie) {
        throw new Error('AdminLogin Cookies are not found.');
    }

    const accessToken = adminLoginCookie.accessToken;

    if (accessToken) {
        config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
};

const failReq = (error: any) => {
    console.log("fail request");
    return Promise.reject(error);
};

const beforeRes = async (res: AxiosResponse): Promise<AxiosResponse> => {
    console.log("beforeRes triggered: Checking access token status");

    // 정상적인 응답은 그대로 반환
    return res;
};

// 요청 실패 시, 리프레시 토큰을 사용하여 새로운 액세스 토큰 발급
const failRes = async (error: any) => {

    console.log("failRes triggered:", error);

    // 응답의 메시지에서 access token 만료나 refresh token 만료 여부를 판단
    if (error.response.data.msg === "Access Token just Expired!!!") {
        console.log("if문 안에서 실행됨")

        const adminloginCookie = cookies.get("adminlogin");

        if (!adminloginCookie) {
            console.error("adminlogin cookie is missing!");
            return Promise.reject(error);
        }

        const { accessToken, refreshToken } = adminloginCookie;

        try {
            // Refresh 요청을 통해 새 토큰 발급
            const refreshResult = await refreshRequest(accessToken, refreshToken);
            console.log("Token refresh result:", refreshResult);

            // 새로운 토큰을 쿠키에 업데이트
            cookies.set("adminlogin", {
                ...adminloginCookie,
                accessToken: refreshResult.accessToken,
                refreshToken: refreshResult.refreshToken
            }, { path: "/", maxAge: (60 * 60 * 24 * 7) });
            console.log("Updated tokens in cookies:", cookies.get("adminlogin"));

            // 원래 요청을 재시도
            const originalRequest = error.config;
            originalRequest.headers.Authorization = `Bearer ${refreshResult.accessToken}`;
            return await axios(originalRequest);

        } catch (refreshError) {
            console.log(error.response.data.msg)
            console.log("reFresh Token has Expired.")

            cookies.remove("adminlogin", { path: "/" })
            console.log("adminlogin cookie removed")

            window.location.href = "/login?error=all";
            console.log("move to loginPage")
            return Promise.reject(refreshError);
        }
    } else {
        console.log(error.response.data.msg)
        console.log("Something got wrong...!!")

        return Promise.reject(error);
    }
    console.log(error.response.data.msg);

    return Promise.reject(error);
}

jwtAxios.interceptors.request.use(beforeReq, failReq);
jwtAxios.interceptors.response.use(beforeRes, failRes);

export default jwtAxios;